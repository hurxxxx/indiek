#!/usr/bin/env python3
"""Weekly aggregate of human page loads from the indiek Nginx JSON access log.

Runs on the web server, read-only. Prints aggregates only: no IP address,
user agent or visitor identifier leaves the server.

    ssh root@<web-server> 'python3 -I - --days 7' < scripts/traffic-report.py

A page load counts when one browser environment (IP + user agent, kept only in
memory) requested an HTML page and also JS/CSS within five minutes. Cached
assets, blocked scripts and shared IPs make this an estimate, not a head count.
"""
import argparse
import glob
import gzip
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
HOSTS = {"indiek.com", "www.indiek.com"}
BOT = re.compile(
    r"bot|crawl|spider|slurp|facebookexternalhit|meta-external|python|curl|wget|go-http|headless"
    r"|httpclient|okhttp|axios|node|java/|libwww|scrapy|preview|monitor|uptime|scan|zgrab|masscan",
    re.I,
)
ASSET = re.compile(r"\.(?:js|mjs|css)$")
BOT_NAME = re.compile(r"([A-Za-z][A-Za-z\-]*(?:bot|crawler|spider|externalhit|agent))", re.I)


def app_family(ua):
    if "Barcelona" in ua:
        return "Threads app"
    if "Instagram" in ua:
        return "Instagram app"
    if "FBAN" in ua or "FBAV" in ua:
        return "Facebook app"
    if "iPhone" in ua or "iPad" in ua:
        return "iOS browser"
    if "Android" in ua:
        return "Android browser"
    return "Desktop browser"


def is_page(path):
    return path.endswith("/") or path.endswith(".html")


def read_rows(log_dir, start, end):
    for name in glob.glob(f"{log_dir}/access.log*"):
        opener = gzip.open if name.endswith(".gz") else open
        with opener(name, "rt", errors="replace") as handle:
            for line in handle:
                try:
                    row = json.loads(line)
                    moment = datetime.fromisoformat(row["time"]).astimezone(KST)
                except (ValueError, KeyError):
                    continue
                if start <= moment < end and row.get("host") in HOSTS and row.get("method") == "GET":
                    row["moment"] = moment
                    yield row


def report(rows, start, end):
    assets = defaultdict(list)
    pages = []
    bots = Counter()
    total = 0
    for row in rows:
        total += 1
        ua, path, status = row.get("user_agent", ""), row.get("path", ""), row.get("status")
        if BOT.search(ua) or "Mozilla" not in ua:
            if is_page(path):
                match = BOT_NAME.search(ua)
                bots[match.group(1) if match else "non-browser"] += 1
            continue
        key = (row.get("ip"), ua)
        if ASSET.search(path) and status in (200, 304):
            assets[key].append(row["moment"])
        elif is_page(path) and status == 200:
            pages.append((key, row["moment"], path))

    daily = defaultdict(lambda: {"pageLoads": 0, "environments": set()})
    apps, hours, paths = Counter(), Counter(), Counter()
    environments = set()
    for key, moment, path in pages:
        if not any(abs((seen - moment).total_seconds()) <= 300 for seen in assets.get(key, ())):
            continue
        day = moment.date().isoformat()
        daily[day]["pageLoads"] += 1
        daily[day]["environments"].add(key)
        environments.add(key)
        apps[app_family(key[1])] += 1
        hours[moment.hour] += 1
        paths[path] += 1

    return {
        "scope": "indiek Nginx log; browser environments that loaded HTML with JS/CSS within 5 minutes",
        "fromKST": start.isoformat(),
        "toKST": end.isoformat(),
        "requests": total,
        "pageLoads": sum(paths.values()),
        "environments": len(environments),
        "daily": {
            day: {"pageLoads": value["pageLoads"], "environments": len(value["environments"])}
            for day, value in sorted(daily.items())
        },
        "pageLoadsByApp": apps.most_common(),
        "pageLoadsByHourKST": dict(sorted(hours.items())),
        "topPaths": paths.most_common(20),
        "botPageRequests": bots.most_common(10),
        "limits": "Includes operator checks; excludes cached or script-blocked visits; shared IPs merge people.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--end", help="exclusive end date, YYYY-MM-DD (KST); default today")
    parser.add_argument("--log-dir", default="/var/log/nginx/indiek")
    args = parser.parse_args()
    end_day = date.fromisoformat(args.end) if args.end else datetime.now(KST).date()
    end = datetime(end_day.year, end_day.month, end_day.day, tzinfo=KST)
    start = end - timedelta(days=args.days)
    print(json.dumps(report(read_rows(args.log_dir, start, end), start, end), indent=1))


if __name__ == "__main__":
    main()

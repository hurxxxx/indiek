import {mkdirSync,copyFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// Timers for the scheduled SNS jobs (deploy/README.md#sns-자동-게시). Times live in the timer units;
// scripts/promotion.test.mjs checks them against promotion/config.json "schedule".
export const promotionUnits=['prepare','threads','instagram','engage','weekly'];

export function install({root=fileURLToPath(new URL('../',import.meta.url)),run=execFileSync}={}) {
  if(process.platform!=='linux'||root.replace(/\/$/,'')!==path.join(homedir(),'projects/indiek'))throw new Error('Run from ~/projects/indiek on the Linux promotion server.');
  const units=path.join(homedir(),'.config/systemd/user');
  for(const dir of [units,path.join(root,'promotion/state'),path.join(homedir(),'.config/indiek-promotion')])mkdirSync(dir,{recursive:true,mode:0o700});
  for(const name of promotionUnits)for(const extension of ['service','timer'])copyFileSync(path.join(root,`deploy/systemd/indiek-promotion-${name}.${extension}`),path.join(units,`indiek-promotion-${name}.${extension}`));
  run('systemctl',['--user','daemon-reload'],{stdio:'inherit'});
  run('systemctl',['--user','enable','--now',...promotionUnits.map(name=>`indiek-promotion-${name}.timer`)],{stdio:'inherit'});
  console.log('Timers installed. Publishing still requires valid account authorization and public source/media. Threads replies stay stopped until `engage resume go-live`.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)install();

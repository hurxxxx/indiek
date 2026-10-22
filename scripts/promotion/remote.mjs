import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {readJSON} from './core.mjs';

// The local CLI requests the sole publisher; credentials and the queue stay there.
export function remoteRequest(args,config) {
  const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const valid=(args.length===1&&['status','check','dry-run'].includes(args[0]))||
    (args.length===2&&args[0]==='story-now'&&slug.test(args[1]))||
    ([3,4].includes(args.length)&&args[0]==='page-now'&&['artist','guide'].includes(args[1])&&slug.test(args[2])&&(args.length===3||args[3]==='--check'));
  if(!valid)throw new Error('Use status, check, dry-run, story-now ID or page-now artist|guide ID [--check].');
  if(!config||!/^[A-Za-z0-9][A-Za-z0-9_.@-]*$/.test(config.host||'')||typeof config.directory!=='string'||!config.directory.startsWith('/')||/[\r\n\0]/.test(config.directory))throw new Error('Configure host and absolute directory in ~/.config/indiek-promotion/remote.json; see SERVER_ACCESS.md.');
  const quote=value=>`'${value.replace(/'/g,"'\\''")}'`;
  return {command:'ssh',args:['-o','BatchMode=yes','-o','ConnectTimeout=10',config.host,`cd ${quote(config.directory)} && node scripts/promotion/run.mjs ${args.map(quote).join(' ')}`]};
}
export function runRemote(args,{config=readJSON(path.join(homedir(),'.config/indiek-promotion/remote.json'),null),execute=spawnSync}={}) {
  const request=remoteRequest(args,config);
  const result=execute(request.command,request.args,{stdio:'inherit'});
  if(result.error)throw new Error('Could not start the remote publisher connection.');
  return result.status??1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try{process.exitCode=runRemote(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
}

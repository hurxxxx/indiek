import {koreanDay} from '../promotion/news.mjs';
import {storyDigest} from './content.mjs';

export function due(state,stories,config,now=new Date()) {
  const day=koreanDay(now);
  const published=stories.filter(s=>s.status==='published');
  if(published.some(s=>s.published===day))return false;
  const cutoff=Date.parse(day)-6*86400000;
  if(published.filter(s=>Date.parse(s.published)>=cutoff&&s.published<=day).length>=config.maxWeeklyPublications)return false;
  const local=new Date(now.getTime()+9*3600000);
  return (config.weekdays.includes(local.getUTCDay())||Boolean(state.deferredUntil&&state.deferredUntil<=day))&&local.getUTCHours()>=config.startHour;
}
export function tomorrow(now) { return koreanDay(new Date(now.getTime()+86400000)); }
export function approval(facts,editorial,story,revision,now=new Date()) {
  if(!facts?.approved||!editorial?.approved||!Array.isArray(facts.issues)||!Array.isArray(editorial.issues)||facts.issues.length||editorial.issues.length)throw new Error('Independent reviews did not approve');
  if(!facts.reason?.trim()||!editorial.reason?.trim()||!editorial.contribution?.trim()||!editorial.referenceIds?.length)throw new Error('Review reasoning missing');
  return {contentHash:storyDigest(story),skillRevision:revision,checkedAt:now.toISOString(),facts,editorial};
}

// Every attempt is saved before a model call. A process restart cannot reset the budget.
export async function prepareIssue({audit,candidates,config,save,research,write,review,now=()=>new Date()}) {
  if(audit.status==='approved')return audit;
  if(audit.status==='exhausted'||audit.status==='deferred')return audit;
  audit.startedAt ||= now().toISOString();
  audit.attempts ||= [];
  audit.candidates ||= candidates.slice(0,config.maxTopics);
  for(const candidate of audit.candidates) {
    let dossier=audit.dossiers?.[candidate.id];
    for(let version=1;version<=config.maxVersionsPerTopic;version++){
      const key=`${candidate.id}:${version}`;
      if(audit.attempts.some(a=>a.key===key))continue;
      if(now().getTime()-Date.parse(audit.startedAt)>=config.deadlineSeconds*1000){
        audit.status='deferred';audit.reason='Preparation time budget reached';await save(audit);return audit;
      }
      const previous=audit.attempts.filter(a=>a.topicId===candidate.id);
      const attempt={key,topicId:candidate.id,version,startedAt:now().toISOString(),status:'started'};
      audit.attempts.push(attempt);await save(audit);
      try{
        if(!dossier||previous.at(-1)?.needsResearch){
          dossier=await research(candidate,previous);
          audit.dossiers ||= {};audit.dossiers[candidate.id]=dossier;await save(audit);
        }
        attempt.story=await write(candidate,dossier,previous);
        const checked=await review(attempt.story,dossier);
        attempt.facts=checked.facts;attempt.editorial=checked.editorial;
        attempt.needsResearch=!checked.facts.approved;
        if(checked.approval){
          attempt.story.review=checked.approval;
          attempt.status='approved';audit.status='approved';audit.story=attempt.story;
          await save(audit);return audit;
        }
        attempt.status='rejected';attempt.reason=[...checked.facts.issues,...checked.editorial.issues].join('\n');
      }catch(error){
        attempt.status='failed';attempt.reason=error.message;
        // Service/auth/time limits are not an excuse to spend 12 more calls on different topics.
        if(error.infrastructure){
          audit.status='deferred';audit.reason=error.message;await save(audit);return audit;
        }
        attempt.needsResearch=true;
      }
      attempt.finishedAt=now().toISOString();await save(audit);
    }
  }
  audit.status='exhausted';audit.reason='All topic/version attempts exhausted; resume next Korean day';await save(audit);return audit;
}

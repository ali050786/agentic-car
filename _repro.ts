import 'dotenv/config';
import { runWithAgentContext } from './core/llm/agentGateway';
import { regenerateDeck } from './core/agents/CarouselPlanner';
import { SlideContent } from './types';
const deck: SlideContent[] = [
  { id:'s1', variant:'hero', headline:"ROBOT'S COOKBOOK", body:'Storybook showed an AI agent assembling a component from your parts.' },
  { id:'s2', variant:'body', headline:'AGENTIC AI READS YOUR TOKENS', body:'It pulls your real variables.' },
  { id:'s3', variant:'body', headline:'FIGMA IS THE SOURCE', body:'Clean files, clean output.' },
  { id:'s4', variant:'list', headline:'HOW TO PREP', listItems:['Name layers','Use variables','Componentize'] },
  { id:'s5', variant:'closing', headline:'FEED THE ROBOT WELL', body:'Garbage in, garbage UI out.' },
];
const instr = 'make it at least 10 to 12 slides, explain in more detail. Make the cover less verbose with a better hook.';
const ne = (s:SlideContent)=>!!(s.headline?.trim()||s.body?.trim()||s.listItems?.length);
runWithAgentContext({ userId:'smoke', selectedModel:'openrouter/deepseek-v4-flash', bypassFreeTier:true } as any, async () => {
  for (let i=1;i<=3;i++){
    const res = await regenerateDeck(deck, 'template-1', instr, 12, [], undefined, undefined);
    const s = res!.slides;
    const empties = s.filter(x=>!ne(x)).length;
    const lastOk = ne(s[s.length-1]) && s[s.length-1].variant==='closing';
    console.log(`run ${i}: ${s.length} slides | empties=${empties} | closing-ok=${lastOk}`);
  }
}).catch(e=>{console.error('ERR:',e.message);process.exit(1);});

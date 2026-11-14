const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];

function harness({raw,now=Date.UTC(2026,10,13,12),lang="fr",shared=new Map()}={}){
  if(raw!==undefined)shared.set("duofit",JSON.stringify(raw));
  const els=new Map(),events={},timeouts=[];
  const el=id=>{
    if(!els.has(id))els.set(id,{id,style:{},dataset:{},value:"",textContent:"",innerHTML:"",open:false,hidden:false,
      setAttribute(){},removeAttribute(){},addEventListener(){},replaceChildren(){this.innerHTML=""},
      showModal(){this.open=true},close(){this.open=false},focus(){},select(){},scrollIntoView(){}});
    return els.get(id);
  };
  let fail=false;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
  const sandbox=vm.createContext({
    console,Date:Clock,navigator:{language:lang},location:{protocol:"file:"},scrollTo(){},
    document:{getElementById:el,querySelector:()=>null,querySelectorAll:()=>[],documentElement:el("root"),addEventListener(){},visibilityState:"visible"},
    window:{addEventListener(type,fn){events[type]=fn}},
    localStorage:{getItem:k=>shared.get(k)??null,setItem(k,v){if(fail)throw Error("full");shared.set(k,v)}},
    setInterval(){},setTimeout(fn){timeouts.push(fn)},clearTimeout(){}
  });
  vm.runInContext(script,sandbox,{filename:"Duo-fit inline script"});
  return {run:code=>vm.runInContext(code,sandbox),state:()=>JSON.parse(shared.get("duofit")),el,
    tick:ms=>{now+=ms;vm.runInContext("tick()",sandbox)},fail:value=>{fail=value},shared,events};
}
module.exports={harness};

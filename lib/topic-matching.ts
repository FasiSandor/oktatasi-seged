const synonymRules:[RegExp,string][]=[
 [/\bpermutaciok\b/g,'permutacio'],[/\bvariaciok\b/g,'variacio'],[/\bkombinaciok\b/g,'kombinacio'],
 [/\bismetleses\b/g,'ismetlessel'],[/\bismetles nelkuli\b/g,'ismetles nelkul'],
 [/\bfuggvenyek\b/g,'fuggveny'],[/\bharomszogek\b/g,'haromszog'],
 [/\bpitagorasz tetele\b/g,'pitagorasz'],[/\bpitagorasz tetel\b/g,'pitagorasz'],
];
export function topicKey(value:string):string{
 let k=value.toLocaleLowerCase('hu').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(\d+\.?\s*(fejezet|lecke|temakor)|fejezet|lecke|temakor|bevezetes|alapjai)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');for(const [from,to] of synonymRules)k=k.replace(from,to);return k;
}
export function topicSimilarity(a:string,b:string):number{
 const aa=topicKey(a),bb=topicKey(b);if(!aa||!bb)return 0;if(aa===bb)return 1;
 const left=new Set(aa.split(' ').filter(x=>x.length>2));const right=new Set(bb.split(' ').filter(x=>x.length>2));
 const shared=[...left].filter(t=>right.has(t)).length;
 if(!shared)return 0;
 return shared/Math.max(left.size,right.size);
}
export function suggestedTopicMatch(title:string,existing:{id:string;name:string}[]):{id:string;name:string;score:number}|null{
 const ranked=existing.map(t=>({...t,score:topicSimilarity(title,t.name)})).sort((a,b)=>b.score-a.score);
 if(!ranked.length||ranked[0].score<0.8||ranked[1]?.score===ranked[0].score)return null;
 return ranked[0];
}

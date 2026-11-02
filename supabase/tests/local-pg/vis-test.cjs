// Local verification of 044-046 on a Vis-shaped project (mirrors live data,
// including Will's wrong 'your-org' member scope and can_view_rates=true on workers).
const {Client}=require('pg');const fs=require('fs');
const DB=process.argv[2]||'wgtest';
const G=JSON.parse(fs.readFileSync(__dirname+'/vis-graph.json','utf8'));
const U={owner:'5ed66d75-f562-41ee-aeee-1d5c5bbbfa04',agworker:'61b6b655-6674-4e1d-9a52-1142fcbfd379',
 sub:'10eb9375-1fa5-4a13-a223-9980db2164a0',subworker:'63a59474-0000-4000-8000-000000000001',
 client:'089ce441-e0c5-4c73-9210-118db3e57cbc',outsider:'0c0c0c0c-0000-4000-8000-000000000009'};
const P='proj_vis', AG='your-org', SUB='party-1793627888381-3rsp', CL='party-1793627888945-ekxf';
const WILL='person-1793627892254-zfp9', ANA='person-1793627891355-u786';
let fails=0; const out=[];
function check(name,cond,detail){out.push(`${cond?'PASS':'FAIL'}  ${name}${detail?'  -> '+detail:''}`); if(!cond) fails++;}
(async()=>{
 const c=new Client({host:'/tmp',port:55432,user:'postgres',database:DB});await c.connect();
 const q=(s,a)=>c.query(s,a);
 await q('BEGIN');
 for(const [k,id] of Object.entries(U)) await q('INSERT INTO auth.users(id,email) VALUES($1,$2)',[id,`hanna.triangle+vis-${k}@mail.grokbot.com`]);
 const parties=[{id:AG,name:'Vis Agency d.o.o.',partyType:'agency',billsTo:[CL],isCreator:true},{id:SUB,name:'Vis Sub Ltd',partyType:'company',billsTo:[AG]},{id:CL,name:'Vis Client GmbH',partyType:'client',billsTo:[]}];
 await q(`INSERT INTO wg_projects(id,name,owner_id,graph,parties) VALUES($1,'Vis',$2,$3,$4)`,[P,U.owner,G,JSON.stringify(parties)]);
 const mem=[['owner','Editor',AG,U.owner,false],['agworker','Contributor',AG,ANA,false],['subworker','Contributor',AG,WILL,false],['sub','Commenter',SUB,'person-1793627891806-o96s',true],['client','Commenter',CL,'person-1793627892699-648a',true]];
 for(const [k,role,scope,node,app] of mem) await q(`INSERT INTO wg_project_members(id,project_id,user_id,user_name,user_email,role,scope,graph_node_id,can_approve,can_view_rates,accepted_at,invited_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,true,now(),now())`,['mem_'+k,P,U[k],k,k+'@x',role,scope,node,app]);
 for(const [org,node,k,role] of [['org_sub',SUB,'sub','company'],['org_cl',CL,'client','client']]){
   await q(`INSERT INTO wg_organizations(id,name,created_by) VALUES($1,$1,$2)`,[org,U.owner]);
   await q(`INSERT INTO wg_project_organizations(id,project_id,organization_id,graph_node_id,party_role,status) VALUES($1,$2,$3,$4,$5,'active')`,['porg_'+org,P,org,node,role]);
   await q(`INSERT INTO wg_organization_members(id,organization_id,user_id,email,org_role,membership_state) VALUES($1,$2,$3,$4,'org_approver','verified')`,['om_'+org,org,U[k],k+'@x']);
 }
 // Seed rates as their writers, through RLS.
 async function as(k,fn){await q('SAVEPOINT s');await q(`SELECT set_config('request.jwt.claim.sub',$1,true)`,[U[k]]);await q('SET LOCAL ROLE authenticated');try{return await fn()}finally{await q('RESET ROLE');await q('RELEASE SAVEPOINT s')}}
 async function tryAs(k,sql,args){await q('SAVEPOINT t');await q(`SELECT set_config('request.jwt.claim.sub',$1,true)`,[U[k]]);await q('SET LOCAL ROLE authenticated');try{const r=await q(sql,args);await q('RESET ROLE');await q('RELEASE SAVEPOINT t');return {ok:true,r}}catch(e){await q('ROLLBACK TO SAVEPOINT t');await q('RESET ROLE');return {ok:false,e:e.message}}}
 const ins=`INSERT INTO wg_link_rates(project_id,link_kind,seller_party_id,buyer_party_id,subject_graph_node_id,amount,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)`;
 let r=await tryAs('owner',ins,[P,'supply',AG,CL,null,80,U.owner]); check('agency writes Agency->Client 80',r.ok,r.e);
 r=await tryAs('owner',ins,[P,'supply',SUB,AG,null,60,U.owner]); check('agency writes Sub->Agency 60 (buyer side)',r.ok,r.e);
 r=await tryAs('sub',ins,[P,'employment',SUB,null,WILL,45,U.sub]); check('sub writes employment Sub->Will 45',r.ok,r.e);
 r=await tryAs('owner',ins,[P,'employment',SUB,null,WILL,99,U.owner]); check('agency CANNOT write the sub\'s employment rate',!r.ok,r.e);
 r=await tryAs('subworker',ins,[P,'supply',AG,CL,WILL,1,U.subworker]); check('worker CANNOT write a supply rate',!r.ok,r.e);
 r=await tryAs('client',ins,[P,'supply',SUB,AG,WILL,1,U.client]); check('client CANNOT write Sub->Agency (not party)',!r.ok,r.e);
 r=await tryAs('outsider',ins,[P,'supply',AG,CL,WILL,1,U.outsider]); check('outsider CANNOT write',!r.ok,r.e);
 r=await tryAs('owner',ins,[P,'supply',AG,CL,null,81,U.owner]); check('duplicate active link rate rejected',!r.ok,r.e);
 const expect={owner:[60,80],agworker:[],sub:[45,60],subworker:[45],client:[80],outsider:[]};
 out.push('\nRATE VISIBILITY (wg_link_rates SELECT):');
 for(const k of Object.keys(expect)){
   const seen=await as(k,async()=> (await q('SELECT amount::float a FROM wg_link_rates ORDER BY 1')).rows.map(x=>x.a));
   check(`${k} sees ${JSON.stringify(expect[k])}`,JSON.stringify(seen)===JSON.stringify(expect[k]),'saw '+JSON.stringify(seen));
 }
 r=await tryAs('client',`UPDATE wg_link_rates SET amount=1 WHERE seller_party_id=$1 AND buyer_party_id=$2 RETURNING id`,[SUB,AG]);
 check('client cannot update Sub->Agency (0 rows)',r.ok&&r.r.rowCount===0,r.e||('rows '+(r.r&&r.r.rowCount)));
 // Invoices (046)
 await q(`INSERT INTO wg_invoices(id,project_id,invoice_number,from_party_id,to_party_id,status,created_by,total,due_date) VALUES('i_viss',$1,'VISS',$2,$3,'draft',$4,480,current_date+30),('i_visa',$1,'VISA',$3,$5,'draft',$4,1280,current_date+30)`,[P,SUB,AG,U.owner,CL]).catch(async e=>{out.push('invoice seed error: '+e.message);});
 const invExp={owner:['VISA','VISS'],agworker:[],sub:['VISS'],subworker:[],client:['VISA'],outsider:[]};
 out.push('\nINVOICE VISIBILITY (wg_invoices SELECT, 046):');
 for(const k of Object.keys(invExp)){
   const seen=await as(k,async()=> (await q('SELECT invoice_number n FROM wg_invoices ORDER BY 1')).rows.map(x=>x.n)).catch(e=>['ERR '+e.message]);
   check(`${k} sees invoices ${JSON.stringify(invExp[k])}`,JSON.stringify(seen)===JSON.stringify(invExp[k]),'saw '+JSON.stringify(seen));
 }
 // Pass-through issue check (047): the same approved week on Sub->Agency AND Agency->Client.
 out.push('\nISSUE CHECK (047, per-seller once):');
 await q('SAVEPOINT wk');await q("SET LOCAL session_replication_role = replica");await q(`INSERT INTO wg_timesheet_weeks(id,project_id,user_id,week_start,status,data) VALUES('tw_will',$1,$2,'2026-11-02','approved','{}')`,[P,U.subworker]).then(async()=>{await q("SET LOCAL session_replication_role = origin");await q('RELEASE SAVEPOINT wk')}).catch(async e=>{out.push('week seed: '+e.message);await q('ROLLBACK TO SAVEPOINT wk')});
 const issue=async(id,num,from,to)=>{await q('SAVEPOINT iss');try{await q(`INSERT INTO wg_invoices(id,project_id,invoice_number,from_party_id,to_party_id,status,created_by,total,due_date,timesheet_ids) VALUES($1,$2,$3,$4,$5,'issued',$6,480,current_date+30,$7)`,[id,P,num,from,to,U.owner,[WILL+':2026-11-02']]);await q('RELEASE SAVEPOINT iss');return 'ok'}catch(e){await q('ROLLBACK TO SAVEPOINT iss');return e.message}};
 let m=await issue('i_s2','S2',SUB,AG); check('issue Sub->Agency with Will week',m==='ok',m);
 m=await issue('i_a2','A2',AG,CL); check('issue Agency->Client with the SAME Will week (pass-through)',m==='ok',m);
 m=await issue('i_s3','S3',SUB,AG); check('second Sub->Agency invoice for the same week is refused',/already billed/.test(m),m);
 // Scoped graph (045)
 out.push('\nSCOPED GRAPH (wg_get_scoped_graph, 045):');
 const gExp={sub:[AG,SUB],client:[AG,CL],subworker:null,agworker:[AG]};
 for(const k of ['owner','sub','client','agworker']){
   const g=await as(k,async()=>(await q('SELECT wg_get_scoped_graph($1) g',[P])).rows[0].g).catch(e=>({err:e.message}));
   if(g.err){check(k+' graph',false,g.err);continue}
   const partiesSeen=g.nodes.filter(n=>n.type==='party').map(n=>n.id).sort();
   const people=g.nodes.filter(n=>n.type==='person').map(n=>n.data.name+(n.data.email?'<'+n.data.email+'>':''));
   const rateKeys=JSON.stringify(g).match(/hourlyRate|"rate"|markup|buyRate/g);
   out.push(`  ${k}: parties=${JSON.stringify(partiesSeen)} people=${JSON.stringify(people)} edges=${g.edges.map(e=>e.data&&e.data.edgeType).join(',')} rateKeys=${rateKeys}`);
   if(gExp[k]) check(`${k} sees parties ${JSON.stringify(gExp[k].slice().sort())}`,JSON.stringify(partiesSeen)===JSON.stringify(gExp[k].slice().sort()));
 }
 const og=await tryAs('outsider','SELECT wg_get_scoped_graph($1)',[P]); check('outsider graph denied',!og.ok,og.e);
 await q('ROLLBACK'); await c.end();
 console.log(out.join('\n')); console.log(`\n${fails} failure(s)`); process.exitCode=fails?1:0;
})().catch(e=>{console.error(e);process.exit(2)});

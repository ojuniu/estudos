/* Seus estudos: entrega os vídeos do Drive ao player do site.
   O <video> pede v/ID; aqui o pedido vai para a API do Drive com o acesso da conta de serviço (no cabeçalho, como o Google exige). */
var API='https://www.googleapis.com/drive/v3/files/',TOK=null,SIZE={};
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('message',function(e){if(e.data&&e.data.tok)TOK=e.data.tok});
function ask(cid,force){
  return (cid?self.clients.get(cid):Promise.resolve(null)).then(function(c){return c||self.clients.matchAll({type:'window'}).then(function(l){return l[0]})}).then(function(c){
    if(!c)throw new Error('sem página');
    return new Promise(function(res,rej){var ch=new MessageChannel(),to=setTimeout(function(){rej(new Error('tempo'))},15000);
      ch.port1.onmessage=function(e){clearTimeout(to);if(e.data&&e.data.t){TOK=e.data;res(TOK)}else rej(new Error('sem acesso'))};
      c.postMessage({q:'tok',force:!!force},[ch.port2])})})}
function token(cid,force){if(!force&&TOK&&TOK.e>Date.now()+60000)return Promise.resolve(TOK);return ask(cid,force)}
function size(id,t){if(SIZE[id])return Promise.resolve(SIZE[id]);
  return fetch(API+id+'?fields=size&supportsAllDrives=true',{headers:{Authorization:'Bearer '+t.t}}).then(function(r){if(!r.ok)throw {st:r.status};return r.json()}).then(function(j){return SIZE[id]=+j.size})}
async function serve(cid,id,rg){
  for(var i=0;i<2;i++){
    var t=await token(cid,i>0),h={Authorization:'Bearer '+t.t};if(rg)h.Range='bytes='+rg[1]+'-'+rg[2];
    var a=await Promise.all([size(id,t).catch(function(x){return {err:(x&&x.st)||0}}),fetch(API+id+'?alt=media&supportsAllDrives=true',{headers:h})]);
    var tot=a[0],r=a[1];
    if(r.status===401||(tot&&tot.err===401))continue;
    if(!r.ok||typeof tot!=='number')return new Response(null,{status:r.ok?502:r.status});
    var ct=r.headers.get('content-type')||'video/mp4';
    if(!rg)return new Response(r.body,{status:200,headers:{'Content-Type':ct,'Content-Length':String(tot),'Accept-Ranges':'bytes'}});
    var s=+rg[1],en=rg[2]?Math.min(+rg[2],tot-1):tot-1;
    return new Response(r.body,{status:206,statusText:'Partial Content',headers:{'Content-Type':ct,'Content-Length':String(en-s+1),'Content-Range':'bytes '+s+'-'+en+'/'+tot,'Accept-Ranges':'bytes'}})}
  return new Response(null,{status:401})}
self.addEventListener('fetch',function(e){
  var u=new URL(e.request.url),m=u.origin===location.origin&&/\/v\/([\w-]{10,})$/.exec(u.pathname);if(!m)return;
  var rg=/bytes=(\d+)-(\d*)/.exec(e.request.headers.get('range')||'');
  e.respondWith(serve(e.clientId,m[1],rg).catch(function(){return Response.error()}))});

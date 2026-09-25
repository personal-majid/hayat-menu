/* answers the background's "read this page" */
chrome.runtime.onMessage.addListener(function(msg, sender, reply){
  if(msg && msg.type === "read"){
    try{ reply(self.HayatCrowd.readCrowd(document)); }catch(e){ reply({ ok:false, why:String(e) }); }
  }
  return true;
});

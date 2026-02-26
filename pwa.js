// Register PWA service worker
if('serviceWorker' in navigator){
  window.addEventListener('load', async ()=>{
    try{
      await navigator.serviceWorker.register('./service-worker.js');
    }catch(e){
      // ignore
    }
  });
}

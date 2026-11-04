// Presenter mode, applied before the first paint and kept across pages.
try{if(sessionStorage.getItem("tsumugi_present")==="1"||/[?&]present=1/.test(location.search))document.documentElement.dataset.present="1"}catch{}

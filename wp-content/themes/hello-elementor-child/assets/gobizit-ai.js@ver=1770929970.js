//top bar code and header scroll code
 document.addEventListener("DOMContentLoaded", function () {
    const topBar = document.getElementById("top-announcement-bar");
    const mainHeader = document.getElementById("header");

    // Ek common function banayein
    function checkScroll() {
      if (window.scrollY > 50) {
        if (topBar) topBar.classList.add("top-bar-hidden");
        if (mainHeader) mainHeader.classList.add("header-scrolled");
      } else {
        if (topBar) topBar.classList.remove("top-bar-hidden");
        if (mainHeader) mainHeader.classList.remove("header-scrolled");
      }
    }

    // 1. Page load hote hi check karein (agar user pehle se scrolled ho)
    checkScroll();

    // 2. Scroll karne par bhi check karein
    window.addEventListener('scroll', checkScroll);
     
    //======================= video button code end ====================
     
   //=====================top bar code and header scroll code ===============================  
     
     // 1. Aapne jahan 'hero-video' ID di hai, wo widget select ho raha hai
    const container = document.getElementById("hero-video");
    if (!container) return;

    // 2. Uske andar ka video element dhoondna
    const video = container.querySelector("video");
    if (!video) return;

    // Button Create Karna
    const btn = document.createElement("div");
    btn.className = "video-control-btn";
    
    const pauseIcon = '<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    const slashIcon = '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';

    // Initial state
    btn.innerHTML = slashIcon;
    container.style.position = "relative"; // Button ko position dene ke liye
    container.appendChild(btn);

    btn.onclick = function() {
        if (video.paused) {
            video.play();
            video.muted = false;
            btn.innerHTML = pauseIcon;
        } else {
            video.pause();
            btn.innerHTML = slashIcon;
        }
    };
     //============================= video button code end ================================================
  });
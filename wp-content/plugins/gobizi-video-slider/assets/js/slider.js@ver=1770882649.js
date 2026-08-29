document.addEventListener('DOMContentLoaded', function() {
    function stopAllVideos() {
        document.querySelectorAll('.gb-card').forEach(card => {
            const modal = card.querySelector('.gb-video-modal');
            if (modal && modal.style.display === 'block') {
                modal.innerHTML = '';
                modal.style.display = 'none';
                card.classList.remove('is-playing');
                const playBtnText = card.querySelector('.gb-play-text');
                const playIcon = card.querySelector('.gb-play-icon svg');
                if (playBtnText) playBtnText.innerText = 'Play story';
                if (playIcon) playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
            }
        });
    }

    // Initialize Swiper for each wrapper
    document.querySelectorAll('.gb-slider-wrapper').forEach(wrapper => {
        const container = wrapper.querySelector('.gb-slider-container');
        const nextEl = wrapper.querySelector('.swiper-button-next');
        const prevEl = wrapper.querySelector('.swiper-button-prev');

        new Swiper(container, {
            slidesPerView: 3,
            spaceBetween: 30,
            centeredSlides: false,
            observer: true,
            observeParents: true,
            grabCursor: true,
            loop: true,
            watchSlidesProgress: true,
            navigation: {
                nextEl: nextEl,
                prevEl: prevEl,
            },
            breakpoints: {
                0: {
                    slidesPerView: 1.2,
                    spaceBetween: 10,
                },
                768: {
                    slidesPerView: 2.2,
                    spaceBetween: 20,
                },
                1100: {
                    slidesPerView: 3,
                    spaceBetween: 30,
                }
            },
            on: {
                slideChange: function() {
                    stopAllVideos();
                }
            }
        });
    });

    // Video Play Logic
    document.addEventListener('click', function(e) {
        const card = e.target.closest('.gb-card');
        if (!card) return;

        const videoUrl = card.getAttribute('data-video');
        const modal = card.querySelector('.gb-video-modal');
        const playBtnText = card.querySelector('.gb-play-text');
        const playIcon = card.querySelector('.gb-play-icon svg');
        
        if (!videoUrl || !modal) return;

        // If clicking while playing (Pause functionality)
        if (card.classList.contains('is-playing')) {
            const video = modal.querySelector('video');
            if (video) {
                if (video.paused) {
                    video.play();
                    if (playBtnText) playBtnText.innerText = 'Pause story';
                    if (playIcon) playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
                } else {
                    video.pause();
                    if (playBtnText) playBtnText.innerText = 'Resume story';
                    if (playIcon) playIcon.innerHTML = '<path d="M8 5v14l11-7z"/>';
                }
            } else {
                stopAllVideos();
            }
            return;
        }

        stopAllVideos();

        let videoHtml = '';
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
            const videoId = extractYouTubeID(videoUrl);
            videoHtml = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&controls=0&modestbranding=1&iv_load_policy=3&disablekb=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;
        } else if (videoUrl.includes('vimeo.com')) {
            const videoId = videoUrl.split('/').pop();
            videoHtml = `<iframe src="https://player.vimeo.com/video/${videoId}?autoplay=1&background=1&muted=0" frameborder="0" allow="autoplay; fullscreen"></iframe>`;
        } else if (videoUrl.endsWith('.mp4')) {
            videoHtml = `<video autoplay loop playsinline><source src="${videoUrl}" type="video/mp4"></video>`;
        }

        if (videoHtml) {
            modal.innerHTML = videoHtml;
            modal.style.display = 'block';
            card.classList.add('is-playing');
            if (playBtnText) playBtnText.innerText = 'Pause story';
            if (playIcon) playIcon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
        }
    });

    function extractYouTubeID(url) {
        let videoId = '';
        if (url.includes('v=')) {
            videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('embed/')) {
            videoId = url.split('embed/')[1].split('?')[0];
        }
        return videoId;
    }
});

jQuery(document).ready(function($) {
    const $wrapper = $('.gb-blog-tabs-wrapper');
    if (!$wrapper.length) return;

    const $grid = $('#gb-blog-posts-grid');
    const $loader = $('#gb-blog-loader');
    const $noMore = $('#gb-blog-no-more');
    const $searchInput = $('#gb-blog-search');
    
    let page = 1;
    let loading = false;
    let noMorePosts = false;
    let searchTerm = '';
    const postsPerPage = $wrapper.data('count') || 9;

    // Search functionality with debounce
    let searchTimeout;
    $searchInput.on('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchTerm = $(this).val();
            page = 1;
            noMorePosts = false;
            $grid.empty();
            $noMore.hide();
            fetchPosts(true);
        }, 500);
    });

    // Infinite Scroll using Intersection Observer
    const observerOptions = {
        root: null,
        rootMargin: '0px 0px 200px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !loading && !noMorePosts) {
                fetchPosts();
            }
        });
    }, observerOptions);

    if ($loader.length) {
        observer.observe($loader[0]);
    }

    function fetchPosts(isSearch = false) {
        if (loading || (noMorePosts && !isSearch)) return;

        loading = true;
        $loader.show();

        $.ajax({
            url: gobiziBlogData.ajax_url,
            type: 'POST',
            data: {
                action: 'gobizi_blog_load_posts',
                search: searchTerm,
                page: page,
                count: postsPerPage,
                nonce: gobiziBlogData.nonce
            },
            success: function(response) {
                const $response = $(response);
                const $newPosts = $response.hasClass('gb-posts-row') ? $response.children() : $response;

                if (isSearch) {
                    $grid.html($response);
                } else if ($newPosts.length) {
                    $grid.find('.gb-posts-row').append($newPosts);
                }

                if (!$newPosts.length || $newPosts.length < postsPerPage) {
                    noMorePosts = true;
                    if (page > 1 || (isSearch && !$newPosts.length)) {
                        $noMore.show();
                    }
                } else {
                    $noMore.hide();
                    page++;
                }

                loading = false;
                $loader.hide();
            },
            error: function() {
                loading = false;
                $loader.hide();
            }
        });
    }
});


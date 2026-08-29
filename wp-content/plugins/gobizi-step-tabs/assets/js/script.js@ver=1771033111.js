jQuery(document).ready(function($) {
    // Reveal container once initialized to prevent FOUC
    $('.gb-step-tabs-container').addClass('loaded');

    $('.gb-step-nav-item').click(function() {
        var $tabs = $(this).closest('.gb-step-tabs-container');
        var index = $(this).data('index');

        // Update Nav
        $tabs.find('.gb-step-nav-item').removeClass('active');
        $(this).addClass('active');

        // Update Image
        $tabs.find('.gb-step-image').removeClass('active');
        $tabs.find('.gb-step-image[data-index="' + index + '"]').addClass('active');
    });
});

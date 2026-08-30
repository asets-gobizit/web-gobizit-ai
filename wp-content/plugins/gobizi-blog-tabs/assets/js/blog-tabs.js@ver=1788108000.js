jQuery(document).ready(function ($) {
  var $wrapper = $(".gb-blog-tabs-wrapper");
  if (!$wrapper.length) {
    return;
  }

  var $cards = $wrapper.find(".gb-blog-card");
  var $searchInput = $("#gb-blog-search");
  var $searchForm = $("#gb-blog-search-form");
  var $searchButton = $("#gb-blog-search-submit");
  var $noMore = $("#gb-blog-no-more");
  var $loader = $("#gb-blog-loader");
  var $noResults = $("#gb-blog-no-results");

  $loader.hide();

  function normalize(value) {
    return (value || "").toString().toLowerCase();
  }

  function cardHaystack($card) {
    var text = normalize($card.text());
    var href = normalize($card.find("a.gb-card-link").attr("href"));
    var alt = normalize($card.find("img").attr("alt"));
    var extra = normalize($card.attr("data-search"));
    return [text, href, alt, extra].join(" ");
  }

  function applyFilter(rawQuery) {
    var query = normalize(rawQuery).trim();
    var visible = 0;

    $cards.each(function () {
      var $card = $(this);
      var match = !query || cardHaystack($card).indexOf(query) !== -1;
      $card.toggleClass("is-hidden-by-search", !match);
      if (match) {
        visible += 1;
      }
    });

    if (query && visible === 0) {
      $noResults.addClass("is-visible").show();
      $noMore.hide();
    } else {
      $noResults.removeClass("is-visible").hide();
      $noMore.hide();
    }
  }

  function onSearch(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    applyFilter($searchInput.val() || "");
    return false;
  }

  $searchForm.on("submit", onSearch);
  $searchButton.on("click", onSearch);
  $searchInput.on("keydown", function (event) {
    if (event.key === "Enter") {
      onSearch(event);
    }
  });
  $searchInput.on("input", function () {
    applyFilter($searchInput.val() || "");
  });

  var params = new URLSearchParams(window.location.search);
  var initial = params.get("q") || params.get("s") || "";
  if (initial) {
    $searchInput.val(initial);
    applyFilter(initial);
  }
});

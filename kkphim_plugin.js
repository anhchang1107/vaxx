// ==========================================
// A. NHÓM CONFIG - KHAI BÁO PLUGIN
// ==========================================

function getManifest() {
    return JSON.stringify({
        "id": "kkphim_api",
        "name": "KKPhim API",
        "version": "1.0.0",
        "baseUrl": "https://phimapi.com",
        "iconUrl": "https://kkphim1.com/uploads/images/logo.png",
        "isEnabled": true,
        "isAdult": false,
        "type": "MOVIE",
        "layoutType": "VERTICAL",
        "playerType": "exoplayer"
    });
}

function getHomeSections() {
    return JSON.stringify([
        { "id": "phim-moi-cap-nhat", "name": "Phim Mới Cập Nhật" },
        { "id": "phim-le", "name": "Phim Lẻ" },
        { "id": "phim-bo", "name": "Phim Bộ" },
        { "id": "hoat-hinh", "name": "Hoạt Hình" },
        { "id": "tv-shows", "name": "TV Shows" }
    ]);
}

function getPrimaryCategories() {
    return JSON.stringify([
        { "id": "hanh-dong", "name": "Hành Động" },
        { "id": "tinh-cam", "name": "Tình Cảm" },
        { "id": "hai-huoc", "name": "Hài Hước" },
        { "id": "co-trang", "name": "Cổ Trang" },
        { "id": "tam-ly", "name": "Tâm Lý" },
        { "id": "vien-tuong", "name": "Viễn Tưởng" }
    ]);
}

function getFilterConfig() {
    return JSON.stringify({});
}

// ==========================================
// B. NHÓM URL - SINH ĐƯỜNG DẪN API
// ==========================================

function getUrlList(slug, filtersJson) {
    var page = 1;
    if (filtersJson) {
        try {
            var filters = JSON.parse(filtersJson);
            if (filters.page) page = filters.page;
        } catch (e) {}
    }

    // Nếu là mục phim mới cập nhật thì gọi API riêng, các mục khác gọi theo danh mục
    if (slug === "phim-moi-cap-nhat") {
        return "https://phimapi.com/danh-sach/phim-moi-cap-nhat?page=" + page;
    } else if (slug === "phim-le" || slug === "phim-bo" || slug === "hoat-hinh" || slug === "tv-shows") {
        return "https://phimapi.com/v1/api/danh-sach/" + slug + "?page=" + page;
    } else {
        // Mặc định xem như là slug của thể loại (Category)
        return "https://phimapi.com/v1/api/the-loai/" + slug + "?page=" + page;
    }
}

function getUrlSearch(keyword, filtersJson) {
    var page = 1;
    if (filtersJson) {
        try {
            var filters = JSON.parse(filtersJson);
            if (filters.page) page = filters.page;
        } catch (e) {}
    }
    // Encode từ khóa tránh lỗi ký tự đặc biệt
    return "https://phimapi.com/v1/api/tim-kiem?keyword=" + encodeURIComponent(keyword) + "&page=" + page;
}

function getUrlDetail(slug) {
    return "https://phimapi.com/phim/" + slug;
}

function getUrlCategories() { return ""; }
function getUrlCountries() { return ""; }
function getUrlYears() { return ""; }

// ==========================================
// C. NHÓM PARSER - XỬ LÝ DỮ LIỆU JSON
// ==========================================

function parseListResponse(html) {
    try {
        var data = JSON.parse(html);
        var items = [];
        var rawItems = [];
        var totalPages = 1;
        var currentPage = 1;

        // API của phimapi.com có 2 cấu trúc trả về tùy endpoint, ta check cả 2 trường hợp:
        if (data.items) {
            rawItems = data.items;
        } else if (data.data && data.data.items) {
            rawItems = data.data.items;
        }

        // Parse phân trang
        if (data.pagination) {
            totalPages = data.pagination.totalPages || 1;
            currentPage = data.pagination.currentPage || 1;
        } else if (data.data && data.data.params && data.data.params.pagination) {
            totalPages = data.data.params.pagination.totalPages || 1;
            currentPage = data.data.params.pagination.currentPage || 1;
        }

        var pathImage = "https://phimimg.com/";

        for (var i = 0; i < rawItems.length; i++) {
            var item = rawItems[i];
            
            // Xử lý link ảnh (đôi khi API trả về full link, đôi khi chỉ trả về slug ảnh)
            var poster = item.poster_url || "";
            if (poster && !poster.startsWith("http")) {
                poster = pathImage + poster;
            }
            var backdrop = item.thumb_url || "";
            if (backdrop && !backdrop.startsWith("http")) {
                backdrop = pathImage + backdrop;
            }

            items.push({
                "id": item.slug,
                "title": item.name,
                "posterUrl": poster,
                "backdropUrl": backdrop,
                "description": item.origin_name || "",
                "year": item.year ? parseInt(item.year) : 2026,
                "quality": item.quality || "HD",
                "episode_current": item.episode_current || "",
                "lang": item.lang || "Vietsub"
            });
        }

        return JSON.stringify({
            "items": items,
            "pagination": {
                "currentPage": currentPage,
                "totalPages": totalPages,
                "totalItems": totalPages * 20,
                "itemsPerPage": 20
            }
        });
    } catch (e) {
        return JSON.stringify({ "items": [], "pagination": { "currentPage": 1, "totalPages": 1 } });
    }
}

// Hàm tìm kiếm dùng chung cấu trúc dữ liệu với hàm danh sách
function parseSearchResponse(html) {
    return parseListResponse(html);
}

function parseMovieDetail(html) {
    try {
        var data = JSON.parse(html);
        var movie = data.movie;
        var episodesData = data.episodes || [];
        
        var pathImage = "https://phimimg.com/";
        var poster = movie.poster_url || "";
        if (poster && !poster.startsWith("http")) poster = pathImage + poster;
        var backdrop = movie.thumb_url || "";
        if (backdrop && !backdrop.startsWith("http")) backdrop = pathImage + backdrop;

        // Parse danh sách Server và Tập phim
        var servers = [];
        for (var i = 0; i < episodesData.length; i++) {
            var svData = episodesData[i];
            var epList = [];
            
            if (svData.server_data) {
                for (var j = 0; j < svData.server_data.length; j++) {
                    var ep = svData.server_data[j];
                    epList.push({
                        "id": ep.link_m3u8, // Đẩy thẳng link m3u8 vào ID để hàm DetailResponse phát luôn
                        "name": ep.name,
                        "slug": ep.slug
                    });
                }
            }

            servers.push({
                "name": svData.server_name || "Server Vip",
                "episodes": epList
            });
        }

        return JSON.stringify({
            "id": movie.slug,
            "title": movie.name,
            "posterUrl": poster,
            "backdropUrl": backdrop,
            "description": movie.content || "",
            "servers": servers,
            "quality": movie.quality || "FHD",
            "year": movie.year ? parseInt(movie.year) : 2026,
            "rating": 10.0,
            "casts": movie.actor ? movie.actor.join(", ") : "",
            "director": movie.director ? movie.director.join(", ") : "",
            "category": movie.category ? movie.category.map(function(c){return c.name;}).join(", ") : "",
            "status": movie.status || "",
            "duration": movie.time || ""
        });
    } catch (e) {
        return JSON.stringify({});
    }
}

// Giải quyết bước cuối cùng: Lấy link stream video m3u8 phát trực tiếp bằng ExoPlayer
function parseDetailResponse(html) {
    // Vì ở bước parseMovieDetail chúng ta đã gán trực tiếp "link_m3u8" vào trường "id" của Episode,
    // lúc này App gọi fetch chính link đó, response thô (html) nhận được chính là link hoặc dữ liệu m3u8.
    // Tuy nhiên theo thiết kế, "html" ở đây cũng có thể chính là token/đường link tùy cấu trúc gọi của App.
    // Để an toàn nhất cho cấu trúc thiết kế của VAAPP:
    return JSON.stringify({
        "url": html, // Phát trực tiếp link HLS m3u8
        "isEmbed": false,
        "mimeType": "application/x-mpegURL",
        "headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
    });
}

/**
 * 金門潮間帶導覽 - 整合腳本
 * 更新：
 * 1. 地圖標記恆顯示地名文字
 * 2. 下拉選單填充地名
 * 3. 點擊標記/選單 -> 先移動地圖FlyTo -> 彈出氣泡窗( Popup) -> 點擊 Popup 內的按鈕 -> 才進入環景 (雄獅堡 3-6.jpg)
 */

const scenes = {
    "古寧頭": {
        title: "古寧頭",
        text: "古寧頭戰役紀念地，擁有廣大的石蚵田與豐富的海岸生態。",
        lat: 24.483025, lon: 118.321078,
        panorama: "images/scene1.jpg",
        links: [{ target: "建功嶼", pitch: 0, yaw: 45, text: "前往建功嶼" }]
    },
    "建功嶼": {
        title: "建功嶼",
        text: "金門地標，退潮時步道浮現，是觀察招潮蟹和彈塗魚的絕佳地點。",
        lat: 24.4265, lon: 118.2865,
        panorama: "images/scene2.jpg",
        links: [
            { target: "古寧頭", pitch: 0, yaw: -90, text: "回到古寧頭" },
            { target: "雄獅堡", pitch: 0, yaw: 90, text: "前往雄獅堡" }
        ]
    },
    "雄獅堡": {
        title: "雄獅堡",
        text: "位於金城海濱的雄獅堡，擁有迷人的日落海景與豐富的潮間帶生物多樣性。",
        lat: 24.4370, lon: 118.3040,
        panorama: "3-6.jpg", 
        links: [{ target: "建功嶼", pitch: 0, yaw: 180, text: "回到建功嶼" }]
    },
    "後湖": {
        title: "後湖",
        text: "金門最著名的沙灘，適合觀察貝類生態，也是戲水熱點。",
        lat: 24.4100, lon: 118.3300,
        panorama: "images/scene3.jpg",
        links: [{ target: "建功嶼", pitch: 0, yaw: -60, text: "回到建功嶼" }]
    },
    "翟山": {
        title: "翟山",
        text: "以花崗岩礁質地形為主，適合觀察附著性生物如藤壺、石鱉。",
        lat: 24.4050, lon: 118.3120,
        panorama: null
    }
};

let viewer = null;
let map, playerMarker;
let allMarkers = [];

window.addEventListener('load', () => {
    if (document.getElementById('map')) initApp();
    initBioInteraction();
});

function initApp() {
    // 1. 初始化地圖
    map = L.map('map').setView([24.44, 118.32], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

    // 獲取下拉選單元素
    const select = document.getElementById('location-select');
    
    // 2. 建立標記、標註地名、填充下拉選單
    for (const id in scenes) {
        const s = scenes[id];
        
        // --- A. 地圖標記與文字標籤 ---
        const m = L.marker([s.lat, s.lon]).addTo(map);
        m.bindTooltip(s.title, {
            permanent: true,       // 永遠顯示文字
            direction: 'right',    // 顯示在標記右側
            className: 'marker-label' 
        }).openTooltip();
        
        // --- B. 建立氣泡窗內容（Popup） ---
        const popupContent = `
            <div class="custom-popup" style="text-align:center;">
                <h3 style="margin: 0 0 5px 0; color:#0077b6;">${s.title}</h3>
                <p style="margin: 0 0 10px 0; font-size:13px; line-height:1.4;">${s.text}</p>
                ${s.panorama ? `<button onclick="enterPanoramaUI('${id}')" style="background:#0077b6; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;"><i class="fas fa-vr-cardboard"></i> 進入環景</button>` : '無環景照片'}
            </div>
        `;
        m.bindPopup(popupContent, { minWidth: 200 }); // 綁定 Popup

        m.on('click', () => {
            // 點擊標記，flyTo 到該位置，不需要監聽 moveend，直接就會彈 Popup
            handleMarkerSelection(id, false); 
        });
        allMarkers.push(m);

        // --- C. 填充下拉選單 ---
        if (select) {
            const opt = document.createElement('option');
            opt.value = id; 
            opt.textContent = s.title;
            select.appendChild(opt);
        }
    }

    // 3. 初始化環景檢視器
    viewer = pannellum.viewer('panViewer', {
        default: { autoLoad: true, firstScene: '', escapeHTML: false },
        scenes: {}
    });

    for (const id in scenes) {
        const s = scenes[id];
        if (s.panorama) {
            viewer.addScene(id, {
                type: 'equirectangular',
                panorama: s.panorama,
                title: s.title,
                hotSpots: (s.links || []).map(link => ({
                    pitch: link.pitch, yaw: link.yaw, type: "scene", text: link.text, sceneId: link.target
                }))
            });
        }
    }

    // 事件監聽：下拉選單切換
    if (select) {
        select.addEventListener('change', (e) => {
            if (e.target.value) handleMarkerSelection(e.target.value, true); // 選單選完自動打開 Popup
        });
    }

    // 關閉環景按鈕
    const closeBtn = document.getElementById('close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closePanorama);
}

// 處理點擊標記或選單選擇：地圖 FlyTo -> 彈 Popup
function handleMarkerSelection(id, openPopupAfterMove) {
    const s = scenes[id];
    if (!s) return;

    // 先平滑移動地圖
    map.flyTo([s.lat, s.lon], 17);

    // 如果是用選單選的，我們希望移動過去後自動把 Popup 打開
    if (openPopupAfterMove) {
        map.once('moveend', () => {
            // 找出對應的標記並打開 Popup
            allMarkers.forEach(m => {
                if(m.getLatLng().lat === s.lat && m.getLatLng().lng === s.lon) {
                    m.openPopup();
                }
            });
        });
    }
}

// 切換至環景介面 (由 Popup 內的按鈕 onclick 觸發)
window.enterPanoramaUI = function(id) {
    const s = scenes[id];
    if(!s || !s.panorama) return;
    
    // UI 切換動畫
    document.getElementById('map').classList.add('minimized');
    document.getElementById('pano-container').classList.add('active');
    document.getElementById('location-info').classList.add('active');
    document.getElementById('close-btn').classList.add('active');
    document.getElementById('location-info').textContent = s.title;
    
    // 隱藏地圖標記，以免干擾
    allMarkers.forEach(m => map.removeLayer(m));

    setTimeout(() => {
        map.invalidateSize();
        // 載入對應場景 (雄獅堡會載入 3-6.jpg)
        viewer.loadScene(id);
    }, 300);

    // 可選：更新資訊欄位
    // updateSpotInfo(id);
}

// 關閉環景回到地圖
function closePanorama() {
    document.getElementById('map').classList.remove('minimized');
    document.getElementById('pano-container').classList.remove('active');
    document.getElementById('location-info').classList.remove('active');
    document.getElementById('close-btn').classList.remove('active');

    // 恢復標記
    allMarkers.forEach(m => map.addLayer(m));

    setTimeout(() => {
        map.invalidateSize();
        map.flyTo([24.44, 118.32], 13);
    }, 500);
}

// 可選：更新資訊欄位 (這裡我先註解掉，以免跟環景內的標題重疊，你可以依需求開啟)
// function updateSpotInfo(id) {
//     const infoBox = document.getElementById("spot-info");
//     if (infoBox && scenes[id]) {
//         infoBox.style.display = "block";
//         infoBox.innerHTML = `<h3><i class="fas fa-info-circle"></i> ${scenes[id].title}</h3><p>${scenes[id].text}</p>`;
//     }
// }

function initBioInteraction() {
    // 這裡保留你原本生物圖鑑的互動代碼
    const cards = document.querySelectorAll(".card");
    const bioDetail = document.getElementById("bioDetail");
    const bioOverlay = document.getElementById("bioOverlay");

    cards.forEach(card => {
        card.addEventListener("click", () => {
            const title = card.dataset.title;
            const desc = card.dataset.description;
            if(document.getElementById("bioTitle")) document.getElementById("bioTitle").textContent = title;
            if(document.getElementById("bioImg")) document.getElementById("bioImg").src = card.dataset.img;
            if(document.getElementById("bioDesc")) document.getElementById("bioDesc").textContent = desc;
            
            if(bioDetail) bioDetail.classList.remove("hidden");
            if(bioOverlay) bioOverlay.classList.remove("hidden");
        });
    });

    const closeBox = () => {
        if(bioDetail) bioDetail.classList.add("hidden");
        if(bioOverlay) bioOverlay.classList.add("hidden");
    };

    if(document.getElementById("closeDetail")) document.getElementById("closeDetail").addEventListener("click", closeBox);
}
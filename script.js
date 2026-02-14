mapboxgl.accessToken = 'pk.eyJ1IjoiMzE1Njk2MWMiLCJhIjoiY21rY20zdzRxMDF5aTNkczdmaG4xMG4yaSJ9.H4SlL1X-zOgcH0h49LYS0g';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/3156961c/cml47t4rc006z01qz77tm9oq7',
  center: [-4.2518, 55.8642],
  zoom: 11,
  customAttribution: '<a href="https://geolytix.com/blog/supermarket-retail-points/" target="_blank">Data: GEOLYTIX</a>'
});

const baseFilters = {
  'budget': ['match', ['get', 'retailer'], ['Lidl', 'Aldi', 'Iceland', 'Farmfoods', 'Asda'], true, false],
  'mid': ['match', ['get', 'retailer'], ['Tesco', 'Morrisons'], true, false],
  'uppermid': ['match', ['get', 'retailer'], ['The Co-operative Group', 'Sainsburys', 'Scottish Midland Co-operative', 'Costco'], true, false],
  'premium': ['match', ['get', 'retailer'], ['Marks and Spencer', 'Waitrose', 'Cook'], true, false]
};

const categories = ['budget', 'mid', 'uppermid', 'premium'];

map.on('load', () => {
  const slider = document.getElementById('layer-slider');
  const searchInput = document.getElementById('store-search');
  const resetButton = document.getElementById('reset-map');
  const pointsToggle = document.getElementById('points-toggle');
  const proximityToggle = document.getElementById('proximity-toggle');
  const proximityStatus = document.getElementById('proximity-status');
  const directoryList = document.getElementById('store-directory-list');

  // --- 1. 颜色与目录逻辑 ---
  function getTierColor(tier) {
    const colors = { budget: '#007cbf', mid: '#5cb11b', uppermid: '#e67e22', premium: '#e74c3c' };
    return colors[tier] || '#666';
  }

  function generateDirectory() {
    let html = '';
    for (const [tier, filter] of Object.entries(baseFilters)) {
      html += `<div class="directory-tier"><strong style="color: ${getTierColor(tier)}">${tier.toUpperCase()}</strong><span>${filter[2].join(', ')}</span></div>`;
    }
    if (directoryList) directoryList.innerHTML = html;
  }
  generateDirectory();

  // --- 2. 1km 探测图层初始化 ---
  map.addSource('buffer-circle', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  map.addLayer({
    id: 'buffer-layer',
    type: 'fill',
    source: 'buffer-circle',
    paint: {
      'fill-color': '#e67e22',
      'fill-opacity': 0.12,
      'fill-outline-color': '#e67e22',
      'fill-outline-width': 1
    }
  });

  // --- 3. 视觉透明度更新逻辑 ---
  function updateVisuals(value) {
    if (pointsToggle && pointsToggle.checked) return;
    categories.forEach((cat, index) => {
      let opacity = Math.max(0, 1 - Math.abs(value - index));
      const hId = `heat_${cat}`, pId = `point_${cat}`;
      if (map.getLayer(hId)) map.setPaintProperty(hId, 'heatmap-opacity', opacity);
      if (map.getLayer(pId)) {
        map.setPaintProperty(pId, 'circle-opacity', opacity);
        map.setPaintProperty(pId, 'circle-stroke-opacity', opacity);
      }
    });
  }

  // --- 4. 核心点击交互逻辑 (探测+弹窗) ---
  map.on('click', (e) => {
    // 强制清除旧弹窗，确保地图整洁
    const popups = document.getElementsByClassName('mapboxgl-popup');
    while (popups[0]) popups[0].remove();

    // 如果 1km 探测开启，执行范围搜索
    if (proximityToggle && proximityToggle.checked) {
      const center = [e.lngLat.lng, e.lngLat.lat];
      const circle = turf.buffer(turf.point(center), 1, { units: 'kilometers' });
      map.getSource('buffer-circle').setData(circle);

      categories.forEach(cat => {
        const pId = `point_${cat}`;
        if (map.getLayer(pId)) {
          const proximityFilter = ['all', baseFilters[cat], ['within', circle]];
          map.setFilter(pId, proximityFilter);
        }
      });
      proximityStatus.innerText = "Active: Showing 1km radius";
    }

    // 检查是否点到图标
    const features = map.queryRenderedFeatures(e.point, { layers: categories.map(cat => `point_${cat}`) });
    
    if (features.length > 0) {
      const f = features[0];
      const p = f.properties;
      const cat = f.layer.id.replace('point_', '');
      const headerColor = getTierColor(cat);
      const fullAddress = [p.add_one, p.add_two].filter(Boolean).join(', ');
      
      // 生成 Google Maps 链接
      const googleSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.fascia + ' ' + (p.postcode || ''))}`;

      const content = `
        <div style="min-width: 190px; font-family: sans-serif; padding-top: 5px;">
          <div style="background: ${headerColor}; height: 6px; border-radius: 4px 4px 0 0; margin: -12px -12px 10px -12px;"></div>
          <strong style="font-size: 15px; color: #333; display: block; margin-bottom: 8px; padding-right: 25px;">${p.fascia || 'Store'}</strong>
          <div style="font-size: 12px; line-height: 1.6;">
            <div style="display: flex; margin-bottom: 4px;"><span style="color: #999; width: 50px; flex-shrink: 0;">Loc:</span><span style="color: #444;">${p.suburb || 'Glasgow'}</span></div>
            <div style="display: flex; margin-bottom: 4px;"><span style="color: #999; width: 50px; flex-shrink: 0;">Addr:</span><span style="color: #444;">${fullAddress || 'N/A'}</span></div>
            <div style="display: flex;"><span style="color: #999; width: 50px; flex-shrink: 0;">Post:</span><span style="color: #444; font-family: monospace;">${p.postcode || 'N/A'}</span></div>
          </div>
          <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; border-top: 1px dotted #eee; padding-top: 10px;">
            <a href="${googleSearchUrl}" target="_blank" style="color: #007cbf; text-decoration: none; font-size: 11px; font-weight: bold;">View Details ↗</a>
            <span style="font-size: 10px; font-weight: bold; color: ${headerColor}; text-transform: uppercase;">${cat}</span>
          </div>
        </div>`;

      // 修复：只保留一个弹窗实例，设置 closeButton 为 true
      new mapboxgl.Popup({ 
          offset: 15, 
          closeButton: true, 
          closeOnClick: true 
        })
        .setLngLat(f.geometry.coordinates)
        .setHTML(content)
        .addTo(map);
    }
  });

  // --- 5. 鼠标与控制面板逻辑 ---
  categories.forEach(cat => {
    map.on('mouseenter', `point_${cat}`, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', `point_${cat}`, () => map.getCanvas().style.cursor = '');
  });

  if (slider) slider.addEventListener('input', (e) => updateVisuals(parseFloat(e.target.value)));

  if (pointsToggle) {
    pointsToggle.addEventListener('change', (e) => {
      const isShowAll = e.target.checked;
      categories.forEach((cat, index) => {
        const pId = `point_${cat}`, hId = `heat_${cat}`;
        if (map.getLayer(pId)) {
          const targetOpacity = isShowAll ? 1 : Math.max(0, 1 - Math.abs(parseFloat(slider.value) - index));
          map.setPaintProperty(pId, 'circle-opacity', targetOpacity);
          map.setPaintProperty(pId, 'circle-stroke-opacity', targetOpacity);
        }
        if (map.getLayer(hId)) {
          const targetHeatOpacity = isShowAll ? 0 : Math.max(0, 1 - Math.abs(parseFloat(slider.value) - index));
          map.setPaintProperty(hId, 'heatmap-opacity', targetHeatOpacity);
        }
      });
    });
  }

  if (proximityToggle) {
    proximityToggle.addEventListener('change', (e) => {
      if (!e.target.checked) {
        map.getSource('buffer-circle').setData({ type: 'FeatureCollection', features: [] });
        categories.forEach(cat => { if (map.getLayer(`point_${cat}`)) map.setFilter(`point_${cat}`, baseFilters[cat]); });
        proximityStatus.innerText = "OFF - Toggle to enable map click search";
        proximityStatus.style.color = "#999";
      } else {
        proximityStatus.innerText = "ON - Click on map to see 1km radius";
        proximityStatus.style.color = "#e67e22";
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value.toLowerCase();
      const bounds = new mapboxgl.LngLatBounds();
      let hasVisibleFeatures = false;
      categories.forEach(cat => {
        const pId = `point_${cat}`, bF = baseFilters[cat];
        if (map.getLayer(pId)) {
          if (value === "") { map.setFilter(pId, bF); updateVisuals(parseFloat(slider.value)); }
          else {
            const sF = ['all', bF, ['>=', ['index-of', value, ['downcase', ['get', 'fascia']]], 0]];
            map.setFilter(pId, sF); map.setPaintProperty(pId, 'circle-opacity', 1);
            map.queryRenderedFeatures({ layers: [pId] }).forEach(f => { bounds.extend(f.geometry.coordinates); hasVisibleFeatures = true; });
          }
        }
      });
      if (value !== "" && hasVisibleFeatures) map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    });
  }

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      searchInput.value = ""; slider.value = 0;
      if (pointsToggle) pointsToggle.checked = false;
      if (proximityToggle) proximityToggle.checked = false;
      map.getSource('buffer-circle').setData({ type: 'FeatureCollection', features: [] });
      categories.forEach(cat => { if (map.getLayer(`point_${cat}`)) map.setFilter(`point_${cat}`, baseFilters[cat]); });
      proximityStatus.innerText = "OFF - Toggle to enable map click search";
      proximityStatus.style.color = "#999";
      const popups = document.getElementsByClassName('mapboxgl-popup');
      while (popups[0]) popups[0].remove();
      updateVisuals(0);
      map.flyTo({ center: [-4.2518, 55.8642], zoom: 11, essential: true });
    });
  }
});
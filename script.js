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
  const directoryList = document.getElementById('store-directory-list');

  // --- 动态目录与颜色逻辑 ---
  function getTierColor(tier) {
    const colors = { budget: '#007cbf', mid: '#5cb11b', uppermid: '#e67e22', premium: '#e74c3c' };
    return colors[tier] || '#666';
  }

  function generateDirectory() {
    let html = '';
    for (const [tier, filter] of Object.entries(baseFilters)) {
      html += `
        <div class="directory-tier">
          <strong style="color: ${getTierColor(tier)}">${tier.toUpperCase()}</strong>
          <span>${filter[2].join(', ')}</span>
        </div>`;
    }
    if (directoryList) directoryList.innerHTML = html;
  }
  generateDirectory();

  // --- 视觉更新函数 ---
  function updateVisuals(value) {
    if (pointsToggle && pointsToggle.checked) return;
    categories.forEach((cat, index) => {
      let opacity = 1 - Math.abs(value - index);
      if (opacity < 0) opacity = 0;
      const hId = `heat_${cat}`, pId = `point_${cat}`;
      if (map.getLayer(hId)) map.setPaintProperty(hId, 'heatmap-opacity', opacity);
      if (map.getLayer(pId)) {
        map.setPaintProperty(pId, 'circle-opacity', opacity);
        map.setPaintProperty(pId, 'circle-stroke-opacity', opacity);
      }
    });
  }

  // --- 滑动条、开关、搜索、重置逻辑 (保留原逻辑) ---
  if (slider) {
    slider.addEventListener('input', (e) => updateVisuals(parseFloat(e.target.value)));
  }

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

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const value = e.target.value.toLowerCase();
      const bounds = new mapboxgl.LngLatBounds();
      let hasVisibleFeatures = false;
      categories.forEach(cat => {
        const pId = `point_${cat}`, hId = `heat_${cat}`, bF = baseFilters[cat];
        if (map.getLayer(pId)) {
          if (value === "") {
            map.setFilter(pId, bF); map.setFilter(hId, bF);
            if (pointsToggle && pointsToggle.checked) {
              map.setPaintProperty(pId, 'circle-opacity', 1);
            } else { updateVisuals(parseFloat(slider.value)); }
          } else {
            const sF = ['all', bF, ['>=', ['index-of', value, ['downcase', ['get', 'fascia']]], 0]];
            map.setFilter(pId, sF); map.setFilter(hId, sF);
            map.setPaintProperty(pId, 'circle-opacity', 1);
            if (map.getLayer(hId)) map.setPaintProperty(hId, 'heatmap-opacity', 0);
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
      categories.forEach(cat => { if (map.getLayer(`point_${cat}`)) map.setFilter(`point_${cat}`, baseFilters[cat]); });
      updateVisuals(0); 
      map.flyTo({ center: [-4.2518, 55.8642], zoom: 11, essential: true });
    });
  }

  // --- 5. 弹窗交互 (新增 postcode, suburb, 合并 add_one & add_two) ---
  categories.forEach(cat => {
    map.on('click', `point_${cat}`, (e) => {
      const p = e.features[0].properties;
      
      // 合并地址行：如果 add_two 存在则拼接，否则只显示 add_one
      const fullAddress = [p.add_one, p.add_two].filter(Boolean).join(', ');
      
      const content = `
        <div style="padding:10px; min-width: 150px;">
          <strong style="font-size:14px; color:#333;">${p.fascia}</strong>
          <div style="margin: 8px 0; font-size:12px; color:#555; line-height:1.4;">
            <p style="margin:2px 0;"><strong>Address:</strong> ${fullAddress || 'N/A'}</p>
            <p style="margin:2px 0;"><strong>Suburb:</strong> ${p.suburb || 'N/A'}</p>
            <p style="margin:2px 0;"><strong>Postcode:</strong> ${p.postcode || 'N/A'}</p>
          </div>
          <span class="tier-label bg-${cat}" style="color:white; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:bold;">${cat.toUpperCase()}</span>
          <div style="font-size:9px; color:#bbb; margin-top:10px; border-top:1px solid #eee; pt-5px;">Source: GEOLYTIX</div>
        </div>`;

      new mapboxgl.Popup({ offset: 15 })
        .setLngLat(e.features[0].geometry.coordinates)
        .setHTML(content)
        .addTo(map);
    });

    map.on('mouseenter', `point_${cat}`, () => map.getCanvas().style.cursor = 'pointer');
    map.on('mouseleave', `point_${cat}`, () => map.getCanvas().style.cursor = '');
  });
});
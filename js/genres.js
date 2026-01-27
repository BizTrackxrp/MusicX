/**
 * XRP Music - Genres Configuration
 * Centralized genre definitions used across the platform
 */

const Genres = {
  // Master list of all genres with metadata
  list: [
    // Hip Hop & Rap
    { id: 'hiphop', name: 'Hip Hop', color: '#f97316', icon: '🎤' },
    { id: 'rap', name: 'Rap', color: '#ef4444', icon: '🔥' },
    { id: 'trap', name: 'Trap', color: '#dc2626', icon: '💎' },
    { id: 'drill', name: 'Drill', color: '#b91c1c', icon: '🔫' },
    
    // Electronic & Dance
    { id: 'electronic', name: 'Electronic', color: '#3b82f6', icon: '⚡' },
    { id: 'edm', name: 'EDM', color: '#2563eb', icon: '🎛️' },
    { id: 'house', name: 'House', color: '#1d4ed8', icon: '🏠' },
    { id: 'techno', name: 'Techno', color: '#1e40af', icon: '🤖' },
    { id: 'dubstep', name: 'Dubstep', color: '#7c3aed', icon: '💥' },
    { id: 'dnb', name: 'Drum & Bass', color: '#6d28d9', icon: '🥁' },
    { id: 'trance', name: 'Trance', color: '#8b5cf6', icon: '🌀' },
    
    // R&B & Soul
    { id: 'rnb', name: 'R&B', color: '#a855f7', icon: '💜' },
    { id: 'soul', name: 'Soul', color: '#9333ea', icon: '✨' },
    { id: 'funk', name: 'Funk', color: '#c026d3', icon: '🕺' },
    
    // Pop & Mainstream
    { id: 'pop', name: 'Pop', color: '#ec4899', icon: '🌟' },
    { id: 'kpop', name: 'K-Pop', color: '#f472b6', icon: '🇰🇷' },
    { id: 'indie', name: 'Indie', color: '#fb7185', icon: '🎸' },
    { id: 'hyperpop', name: 'Hyperpop', color: '#f43f5e', icon: '💫' },
    
    // Rock & Alternative
    { id: 'rock', name: 'Rock', color: '#84cc16', icon: '🎸' },
    { id: 'alternative', name: 'Alternative', color: '#65a30d', icon: '🔊' },
    { id: 'punk', name: 'Punk', color: '#4d7c0f', icon: '⚡' },
    { id: 'metal', name: 'Metal', color: '#365314', icon: '🤘' },
    { id: 'grunge', name: 'Grunge', color: '#78716c', icon: '🎤' },
    
    // Country & Folk
    { id: 'country', name: 'Country', color: '#f59e0b', icon: '🤠' },
    { id: 'folk', name: 'Folk', color: '#d97706', icon: '🪕' },
    { id: 'bluegrass', name: 'Bluegrass', color: '#b45309', icon: '🎻' },
    { id: 'americana', name: 'Americana', color: '#92400e', icon: '🦅' },
    
    // Jazz & Blues
    { id: 'jazz', name: 'Jazz', color: '#06b6d4', icon: '🎷' },
    { id: 'blues', name: 'Blues', color: '#0891b2', icon: '🎸' },
    { id: 'swing', name: 'Swing', color: '#0e7490', icon: '🎺' },
    
    // Latin & World
    { id: 'latin', name: 'Latin', color: '#f97316', icon: '💃' },
    { id: 'reggaeton', name: 'Reggaeton', color: '#ea580c', icon: '🔥' },
    { id: 'salsa', name: 'Salsa', color: '#c2410c', icon: '🌶️' },
    { id: 'afrobeat', name: 'Afrobeat', color: '#15803d', icon: '🌍' },
    { id: 'reggae', name: 'Reggae', color: '#16a34a', icon: '🇯🇲' },
    
    // Chill & Ambient
    { id: 'lofi', name: 'Lo-Fi', color: '#8b5cf6', icon: '☕' },
    { id: 'ambient', name: 'Ambient', color: '#64748b', icon: '🌙' },
    { id: 'chillwave', name: 'Chillwave', color: '#94a3b8', icon: '🌊' },
    { id: 'downtempo', name: 'Downtempo', color: '#475569', icon: '🎧' },
    
    // Classical & Orchestral
    { id: 'classical', name: 'Classical', color: '#a16207', icon: '🎻' },
    { id: 'orchestral', name: 'Orchestral', color: '#854d0e', icon: '🎼' },
    { id: 'cinematic', name: 'Cinematic', color: '#713f12', icon: '🎬' },
    
    // Experimental & Other
    { id: 'experimental', name: 'Experimental', color: '#525252', icon: '🔬' },
    { id: 'instrumental', name: 'Instrumental', color: '#737373', icon: '🎹' },
    { id: 'soundtrack', name: 'Soundtrack', color: '#a3a3a3', icon: '🎞️' },
    { id: 'spoken', name: 'Spoken Word', color: '#d4d4d4', icon: '🎙️' },
    { id: 'podcast', name: 'Podcast', color: '#e5e5e5', icon: '🎧' },
    { id: 'other', name: 'Other', color: '#6b7280', icon: '🎵' },
  ],
  
  // Get genre by ID
  get(id) {
    return this.list.find(g => g.id === id) || { id: 'other', name: 'Other', color: '#6b7280', icon: '🎵' };
  },
  
  // Get multiple genres by IDs
  getMultiple(ids) {
    return ids.map(id => this.get(id)).filter(Boolean);
  },
  
  // Get all genre IDs
  getIds() {
    return this.list.map(g => g.id);
  },
  
  // Get genres grouped by category for UI
  getGrouped() {
    return {
      'Hip Hop & Rap': this.list.filter(g => ['hiphop', 'rap', 'trap', 'drill'].includes(g.id)),
      'Electronic & Dance': this.list.filter(g => ['electronic', 'edm', 'house', 'techno', 'dubstep', 'dnb', 'trance'].includes(g.id)),
      'R&B & Soul': this.list.filter(g => ['rnb', 'soul', 'funk'].includes(g.id)),
      'Pop & Mainstream': this.list.filter(g => ['pop', 'kpop', 'indie', 'hyperpop'].includes(g.id)),
      'Rock & Alternative': this.list.filter(g => ['rock', 'alternative', 'punk', 'metal', 'grunge'].includes(g.id)),
      'Country & Folk': this.list.filter(g => ['country', 'folk', 'bluegrass', 'americana'].includes(g.id)),
      'Jazz & Blues': this.list.filter(g => ['jazz', 'blues', 'swing'].includes(g.id)),
      'Latin & World': this.list.filter(g => ['latin', 'reggaeton', 'salsa', 'afrobeat', 'reggae'].includes(g.id)),
      'Chill & Ambient': this.list.filter(g => ['lofi', 'ambient', 'chillwave', 'downtempo'].includes(g.id)),
      'Classical & Orchestral': this.list.filter(g => ['classical', 'orchestral', 'cinematic'].includes(g.id)),
      'Other': this.list.filter(g => ['experimental', 'instrumental', 'soundtrack', 'spoken', 'podcast', 'other'].includes(g.id)),
    };
  },
  
  // Render a genre chip/badge
  renderChip(genreId, options = {}) {
    const genre = this.get(genreId);
    const size = options.size || 'md';
    const clickable = options.clickable !== false;
    const showIcon = options.showIcon !== false;
    
    const sizeClasses = {
      sm: 'genre-chip-sm',
      md: 'genre-chip-md',
      lg: 'genre-chip-lg',
    };
    
    return `
      <${clickable ? 'button' : 'span'} 
        class="genre-chip ${sizeClasses[size]} ${clickable ? 'genre-chip-clickable' : ''}"
        data-genre="${genre.id}"
        style="--genre-color: ${genre.color}"
        ${clickable ? `onclick="Router.navigate('genre', { id: '${genre.id}' })"` : ''}
      >
        ${showIcon ? `<span class="genre-icon">${genre.icon}</span>` : ''}
        <span class="genre-name">${genre.name}</span>
      </${clickable ? 'button' : 'span'}>
    `;
  },
  
  // Render genre selector grid (for forms)
  renderSelector(options = {}) {
    const selected = options.selected || [];
    const maxSelect = options.maxSelect || 2;
    const grouped = options.grouped !== false;
    const inputName = options.inputName || 'genre';
    
    if (grouped) {
      const groups = this.getGrouped();
      return `
        <div class="genre-selector grouped" data-max="${maxSelect}" data-input="${inputName}">
          ${Object.entries(groups).map(([category, genres]) => `
            <div class="genre-category">
              <div class="genre-category-title">${category}</div>
              <div class="genre-category-chips">
                ${genres.map(genre => `
                  <button type="button" 
                    class="genre-chip ${selected.includes(genre.id) ? 'selected' : ''}" 
                    data-genre="${genre.id}"
                    style="--genre-color: ${genre.color}">
                    <span class="genre-icon">${genre.icon}</span>
                    <span class="genre-name">${genre.name}</span>
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      return `
        <div class="genre-selector" data-max="${maxSelect}" data-input="${inputName}">
          <div class="genre-chips-grid">
            ${this.list.map(genre => `
              <button type="button" 
                class="genre-chip ${selected.includes(genre.id) ? 'selected' : ''}" 
                data-genre="${genre.id}"
                style="--genre-color: ${genre.color}">
                <span class="genre-icon">${genre.icon}</span>
                <span class="genre-name">${genre.name}</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }
  },
  
  // Initialize genre selector interactivity
  initSelector(container, onChange) {
    const selector = container.querySelector('.genre-selector');
    if (!selector) return;
    
    const maxSelect = parseInt(selector.dataset.max) || 2;
    const selected = [];
    
    // Get initially selected
    selector.querySelectorAll('.genre-chip.selected').forEach(chip => {
      selected.push(chip.dataset.genre);
    });
    
    selector.querySelectorAll('.genre-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const genreId = chip.dataset.genre;
        const idx = selected.indexOf(genreId);
        
        if (idx > -1) {
          // Deselect
          selected.splice(idx, 1);
          chip.classList.remove('selected');
        } else if (selected.length < maxSelect) {
          // Select
          selected.push(genreId);
          chip.classList.add('selected');
        } else {
          // Replace oldest selection
          const oldGenre = selected.shift();
          selector.querySelector(`.genre-chip[data-genre="${oldGenre}"]`)?.classList.remove('selected');
          selected.push(genreId);
          chip.classList.add('selected');
        }
        
        if (onChange) onChange(selected);
      });
    });
    
    return {
      getSelected: () => [...selected],
      setSelected: (newSelected) => {
        selected.length = 0;
        selected.push(...newSelected);
        selector.querySelectorAll('.genre-chip').forEach(chip => {
          chip.classList.toggle('selected', selected.includes(chip.dataset.genre));
        });
      }
    };
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Genres;
}

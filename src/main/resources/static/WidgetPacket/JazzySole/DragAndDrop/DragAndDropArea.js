// DragAndDropArea.js
// Reusable drag-and-drop area for 3DEXPERIENCE objects and custom data

define('DragAndDropArea', [
    'UWA/Class',
    'css!DragAndDropArea'
], function (Class) {
    'use strict';

    var DragAndDropArea = Class.extend({
        init: function(options) {
            options = options || {};
            this.container = options.container || document.body;
            this.validationFunction = options.validationFunction || function() { return true; };
            this.onDrop = options.onDrop || function() {};
            this.cssClass = options.cssClass || 'dnd-area-default';
            this.label = options.label || 'Drop items here';
            this.contentHtml = options.contentHtml || null;
            this.acceptedTypes = options.acceptedTypes || [];
            this._render();
        },
        _render: function() {
            // Remove previous area if exists
            if (this.area && this.area.parentNode) {
                this.area.parentNode.removeChild(this.area);
            }
            
            var area = document.createElement('div');
            area.className = 'drag-drop-area ' + this.cssClass;
            
            // Use contentHtml if provided, otherwise fallback to label with enhanced styling
            var labelHtml = this.contentHtml ? this.contentHtml : 
                '<div class="drag-drop-icon">' +
                    '<i class="fa fa-cubes" style="font-size: 32px; color: #007bff;"></i>' +
                '</div>' +
                '<div class="dnd-label">' + this.label + '</div>';
                
            // Only add the dnd-zone if no custom contentHtml is provided
            var zoneHtml = this.contentHtml ? '' : 
                '<div class="dnd-zone">' +
                    '<span class="dnd-invite primary-text">Drag & drop objects here</span>' +
                    '<p class="secondary-text">VPMReference and Raw_Material objects supported</p>' +
                '</div>';
                
            area.innerHTML = labelHtml + zoneHtml +
                '<div class="dnd-status"></div>' +
                '<div id="droppable" class="hidden"></div>';
            
            this.container.appendChild(area);
            this.area = area;
            this.status = area.querySelector('.dnd-status');
            this.droppable = area.querySelector('#droppable');
            
            // Ensure status area is visible and properly styled
            if (this.status) {
                this.status.style.display = 'none'; // Initially hidden
                this.status.style.minHeight = '20px';
                this.status.style.marginTop = '10px';
            }
            
            var zone = area.querySelector('.dnd-zone');
            
            // Enhanced drag events with better visual feedback - using LibraryClassViewer approach
            // Attach events to the entire area, not just the zone, for better hover detection
            area.addEventListener('dragover', this._onDragOver.bind(this));
            area.addEventListener('dragleave', this._onDragLeave.bind(this));
            area.addEventListener('dragenter', this._onDragEnter.bind(this));
            area.addEventListener('drop', this._onDrop.bind(this));
            
            // Add hover effects to entire area
            area.addEventListener('mouseenter', this._onMouseEnter.bind(this));
            area.addEventListener('mouseleave', this._onMouseLeave.bind(this));
        },
        _onDragEnter: function(e) {
            e.preventDefault();
            // Clear any previous cleanup timeouts
            if (this._cleanupTimeout) {
                clearTimeout(this._cleanupTimeout);
                this._cleanupTimeout = null;
            }
            this._addDroppableStyle();
        },
        
        _onDragOver: function(e) {
            e.preventDefault();
            // Clear any previous cleanup timeouts
            if (this._cleanupTimeout) {
                clearTimeout(this._cleanupTimeout);
                this._cleanupTimeout = null;
            }
            this.area.classList.add('dnd-over', 'drag-over');
            this._addDroppableStyle();
        },
        
        _onDragLeave: function(e) {
            var self = this;
            
            // Use LibraryClassViewer's approach - more robust leave detection
            var targetClass = e.target.className;
            
            // If leaving to a droppable element, remove highlighting 
            if (targetClass && targetClass.indexOf('droppable') !== -1 && targetClass.indexOf('show') !== -1) {
                this.area.classList.remove('dnd-over', 'drag-over');
                this._removeDroppableStyle();
                return;
            }
            
            // Use timeout-based cleanup to handle edge cases
            this._cleanupTimeout = setTimeout(function() {
                // Check if we're still not dragging over the area
                if (!self.area.matches(':hover') && !self.area.classList.contains('dnd-over')) {
                    self.area.classList.remove('dnd-over', 'drag-over');
                    self._removeDroppableStyle();
                }
            }, 100);
        },
        
        _onMouseEnter: function(e) {
            // Add subtle hover effect
            this.area.style.borderColor = '#0056b3';
        },
        
        _onMouseLeave: function(e) {
            // Reset hover effect if not dragging - more reliable detection
            if (!this.area.classList.contains('dnd-over') && !this.area.classList.contains('drag-over')) {
                this.area.style.borderColor = '';
                // Also ensure droppable style is removed when not dragging
                this._removeDroppableStyle();
            }
        },
        
        // LibraryClassViewer-style droppable highlighting
        _addDroppableStyle: function() {
            if (this.droppable) {
                this.droppable.classList.remove('hidden');
                this.droppable.classList.add('show', 'droppable');
            }
        },
        
        _removeDroppableStyle: function() {
            if (this.droppable) {
                this.droppable.classList.remove('show', 'droppable');
                this.droppable.classList.add('hidden');
            }
        },
        _onDrop: function(e) {
            e.preventDefault();
            
            // Clear any pending cleanup timeouts
            if (this._cleanupTimeout) {
                clearTimeout(this._cleanupTimeout);
                this._cleanupTimeout = null;
            }
            
            // Remove all drag-related styling immediately
            this.area.classList.remove('dnd-over', 'drag-over');
            this._removeDroppableStyle();
            
            var data = e.dataTransfer.getData('text');
            var parsed;
            try {
                parsed = JSON.parse(data);
            } catch (err) {
                parsed = data;
            }
            
            // Validate and filter
            var valid = this.validationFunction(parsed, this.acceptedTypes);
            if (valid) {
                this.showStatus('Processing dropped items...', 'success');
                this.onDrop(parsed);
            } else {
                this.showStatus('Rejected - Invalid item type', 'error');
                // Auto-clear error message after 3 seconds
                setTimeout(() => {
                    this.status.textContent = '';
                    this.status.className = 'dnd-status';
                }, 3000);
            }
        },
        
        showStatus: function(msg, type) {
            this.status.textContent = msg;
            this.status.className = 'dnd-status ' + (type === 'success' ? 'dnd-success' : 'dnd-error');
            this.status.style.display = 'block';
            console.log('[DragAndDropArea] Status shown:', msg, 'type:', type);
        },
        
        clearStatus: function() {
            this.status.textContent = '';
            this.status.className = 'dnd-status';
            this.status.style.display = 'none';
        },
        
        // Method to show validation state - required by LibraryPartCode
        showValidationState: function(message, isValid) {
            if (isValid) {
                this.showStatus(message, 'success');
            } else {
                this.showStatus(message, 'error');
            }
        },
        
        destroy: function() {
            if (this.area && this.area.parentNode) {
                this.area.parentNode.removeChild(this.area);
            }
        }
    });

    return DragAndDropArea;
});

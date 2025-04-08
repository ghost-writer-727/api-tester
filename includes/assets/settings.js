jQuery(document).ready(function($){
    console.log(api_tester.presets);
//    console.log(api_tester.presets.preset_1743784043481.body); 
    /*
    prints the following js object (not a string): 
    {
        "poNumber": "",
        "inhandDate": "",
        "externalOrderNumber": "",
        "shipping": "jsonObject",
        "lineItems": "jsonObject",
        "orderNotes": "",
        "graphicApprovals": "jsonObject",
        "artFiles": ""
    }
    */
       
//    console.log(api_tester.presets.preset_1742936581961.body); 
    /*
    prints the following js object (not a string): 
    {
    "1": {
        "3": [
            "6"
        ]
    },
    "7": "8"
    }
    
    */
    // Initialize form elements
    const $form = $('.api-tester-form');
    
    // Validate and update body field based on content type
    function validateBodyField(){
        const $method = $('select[name="method"]');
        const $contentType = $('select[name="content_type"]');
        const $bodyInputs = $('.array-inputs[data-field="body"]');
        const $textInput = $('input[name="body"]');
        const contentType = $contentType.val();
        const $rootType = $bodyInputs.closest('.form-field').find('.array-root-type');

        if (contentType === 'text/plain') {
            // Store current array value before switching to text
            if (!$bodyInputs.data('saved-array-value')) {
                $bodyInputs.data('saved-array-value', $textInput.val());
            }
            // Store current text value if switching from text to something else
            if ($bodyInputs.is(':hidden') && $textInput.is(':visible')) {
                $bodyInputs.data('saved-text-value', $textInput.val());
            }
            // Show text input, hide array inputs
            $bodyInputs.hide();
            $textInput.show();
            // Restore previous text value if it exists
            const savedText = $bodyInputs.data('saved-text-value');
            if (savedText !== undefined) {
                $textInput.val(savedText);
            }
            // Hide the root type selector
            $rootType.hide();
        } else {
            // Show array inputs, hide text input
            $bodyInputs.show();
            $textInput.hide();
            // Show the root type selector
            $rootType.show();
            // Restore previous array value if it exists
            const savedArrayValue = $bodyInputs.data('saved-array-value');
            if (savedArrayValue !== undefined) {
                $textInput.val(savedArrayValue);
            }
            
            // Force object mode for form-urlencoded
            if (contentType === 'application/x-www-form-urlencoded') {
                const $rootType = $bodyInputs.closest('.form-field').find('.array-root-type');
                if ($rootType.val() !== 'object') {
                    $rootType.val('object').trigger('change');
                }
                $rootType.prop('disabled', true);
            } else {
                $rootType.prop('disabled', false);
            }
            
            // Handle nesting for JSON
            if (contentType === 'application/json') {
                // Show nesting buttons
                $bodyInputs.find('.array-nested').show();
                
                // Restore any saved nested containers
                $bodyInputs.find('> .array-row').each(function() {
                    const $row = $(this);
                    const savedNested = $row.data('saved-nested');
                    if (savedNested) {
                        $row.after(savedNested);
                        $row.removeData('saved-nested');
                    }
                });
                // Update JSON after restoring nested content
                updateArrayField($bodyInputs);
            } else {
                // Hide nesting buttons
                $bodyInputs.find('.array-nested').hide();
                
                // Store and remove any nested containers
                $bodyInputs.find('> .array-row').each(function() {
                    const $row = $(this);
                    const $nested = $row.next('.nested-array-container');
                    if ($nested.length) {
                        $row.data('saved-nested', $nested);
                        $nested.detach();
                    }
                });
                // Update JSON after removing nested content
                updateArrayField($bodyInputs);
            }
        }
    }
    
    // Check on page load
    validateBodyField();
    
    // Check on change
    $(document).on('change', 'select[name="content_type"]', validateBodyField);

    const $runButton = $('.api-tester-run');
    const $saveButton = $('.api-tester-save');
    const $duplicateButton = $('.api-tester-duplicate');
    const $deleteButton = $('.api-tester-delete');
    const $streamField = $('#api_tester_stream');
    const $filenameField = $('.form-field.api_tester_filename_field');
    const $responseTabs = $('.api-response-tabs');
    const $responseHeader = $('.api-response-header');
    const $responseBody = $('.api-response-body');
    const $responseArgs = $('.api-response-args');
    const $formOverlay = $('<div class="api-tester-form-overlay"></div>');

    var presetId = $form.data('preset-id');
    
    // Add overlay div to form
    $form.append($formOverlay);

    // Helper function to handle loading states
    function setFormLoading(isLoading, $button = null) {
        if (isLoading) {
            // Disable only the bottom form buttons, not preset buttons
            $('.api-tester-buttons .button').prop('disabled', true);
            $formOverlay.addClass('active');
            if ($button && $button.closest('.api-tester-buttons').length) {
                $button.addClass('button-loading');
            }
        } else {
            $('.api-tester-buttons .button').prop('disabled', false);
            $formOverlay.removeClass('active');
            $('.button-loading').removeClass('button-loading');
        }
    }
    // Helper functions for array inputs
    function createArrayRow(isNested = false) {
        const $row = $(`
            <span class="array-row">
                <input type="text" class="array-key" placeholder="Key">
                <input type="text" class="array-value" placeholder="Value">
                <select class="array-type-toggle" style="display:none">
                    <option value="array">Array</option>
                    <option value="object" selected>Object</option>
                </select>
                <button type="button" class="button-link array-nested" title="Add child item">
                    <span class="dashicons dashicons-plus"></span>
                </button>
                <button type="button" class="button-link array-remove">
                    <span class="dashicons dashicons-no-alt"></span>
                </button>
            </span>
        `);

        // Add event handler for when a nested container is added
        const updateValueVisibility = () => {
            const hasNested = $row.next('.nested-array-container').length > 0;
            $row.find('.array-value').toggle(!hasNested);
            $row.find('.array-type-toggle').toggle(hasNested);
        };

        // Store observer reference for cleanup
        let observer = null;

        // Set up mutation observer after row is added to DOM
        setTimeout(() => {
            const parent = $row.parent()[0];
            if (parent) {
                observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList') {
                            updateValueVisibility();
                        }
                    });
                });
                observer.observe(parent, { childList: true });
                
                // Initial check after DOM attachment
                updateValueVisibility();
            }
        }, 0);

        // Clean up observer when row is removed
        $row.on('remove', () => {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
        });
        
        return $row;
    }

    function updateArrayField($container) {
        // Get the field name from the container's data attribute
        const fieldName = $container.data('field');
        
        // Find the array-text-value input within the same form field
        const $jsonField = $('input.array-text-value[name="' + fieldName + '"]');
        // If no input found, log error and return
        if (!$jsonField.length) {
            console.error('Array text value input not found for array field');
            return;
        }

        // Find the root type selector
        const $rootType = $container.closest('.form-field').find('.array-root-type');
        const isRootArray = $rootType.length && $rootType.val() === 'array';
        
        // Toggle visibility of top-level keys based on root type
        $container.find('> .array-row > .array-key').toggle(!isRootArray);

        let result;
        if (isRootArray) {
            result = [];
            $container.find('> .array-row').each(function() {
                const $row = $(this);
                // Even in array mode, we process the row as if it were an object
                // to maintain the key information
                const processed = processRow($row);
                if (processed) {
                    // For arrays, we only care about the values
                    result.push(Object.values(processed)[0]);
                    
                    // Store the key in the DOM for when we switch back to object mode
                    const key = $row.find('> .array-key').val();
                    if (key && !$row.find('> .array-key').data('saved-key')) {
                        $row.find('> .array-key').data('saved-key', key);
                    }
                }
            });
        } else {
            result = {};
            // First pass: collect all keys to detect duplicates
            const keyMap = {};
            $container.find('> .array-row').each(function() {
                const $row = $(this);
                const key = $row.find('> .array-key').val().trim();
                if (key) {
                    if (keyMap[key]) {
                        keyMap[key].push($row);
                    } else {
                        keyMap[key] = [$row];
                    }
                }
            });
            
            // Highlight duplicate keys with red outlines
            for (const key in keyMap) {
                if (keyMap[key].length > 1) {
                    // All rows except the last one will be overridden
                    keyMap[key].forEach(($row, index) => {
                        const $keyInput = $row.find('> .array-key');
                        if (index < keyMap[key].length - 1) {
                            // This key will be overridden - highlight in red
                            $keyInput.css('outline', '2px solid red');
                            $keyInput.attr('title', 'Warning: This key will be overridden by another key with the same name');
                        } else {
                            // This is the key that will be used
                            $keyInput.css('outline', '');
                            $keyInput.attr('title', 'This key will override previous keys with the same name');
                        }
                    });
                } else {
                    // No duplicate, remove any existing highlight
                    keyMap[key][0].find('> .array-key').css('outline', '').removeAttr('title');
                }
            }
            
            // Second pass: build the result object
            $container.find('> .array-row').each(function() {
                const processed = processRow($(this));
                if (processed) {
                    // Object.assign will naturally override duplicate keys with the latest value
                    Object.assign(result, processed);
                }
            });
        }

        function processRow($row) {
            const key = $row.find('> .array-key').val();
            const $value = $row.find('> .array-value');
            const $nestedContainer = $row.next('.nested-array-container');
            const type = $row.find('> .array-type-toggle').val() || 'object';
            
            // Skip if row is completely empty (no key, no value, no nested items)
            if (!key && !$nestedContainer.length && !$value.val()) return null;
            
            if ($nestedContainer.length) {
                const trimmedKey = key.trim();
                if (type === 'array') {
                    // Handle as array - ignore keys
                    const nestedArray = [];
                    $nestedContainer.find('> .array-row').each(function() {
                        const $childRow = $(this);
                        const childValue = $childRow.find('> .array-value').val();
                        const $childNested = $childRow.next('.nested-array-container');
                        
                        if ($childNested.length) {
                            const nestedResult = processRow($childRow);
                            if (nestedResult) {
                                nestedArray.push(Object.values(nestedResult)[0]);
                            }
                        } else if (childValue) {
                            nestedArray.push(childValue.trim());
                        }
                    });
                    return { [trimmedKey]: nestedArray };
                } else {
                    // Handle as object - keep keys
                    const nestedObj = {};
                    
                    // First pass: collect all keys to detect duplicates
                    const keyMap = {};
                    $nestedContainer.find('> .array-row').each(function() {
                        const $row = $(this);
                        const key = $row.find('> .array-key').val().trim();
                        if (key) {
                            if (keyMap[key]) {
                                keyMap[key].push($row);
                            } else {
                                keyMap[key] = [$row];
                            }
                        }
                    });
                    
                    // Highlight duplicate keys with red outlines
                    for (const key in keyMap) {
                        if (keyMap[key].length > 1) {
                            // All rows except the last one will be overridden
                            keyMap[key].forEach(($row, index) => {
                                const $keyInput = $row.find('> .array-key');
                                if (index < keyMap[key].length - 1) {
                                    // This key will be overridden - highlight in red
                                    $keyInput.css('outline', '2px solid red');
                                    $keyInput.attr('title', 'Warning: This key will be overridden by another key with the same name');
                                } else {
                                    // This is the key that will be used
                                    $keyInput.css('outline', '');
                                    $keyInput.attr('title', 'This key will override previous keys with the same name');
                                }
                            });
                        } else {
                            // No duplicate, remove any existing highlight
                            keyMap[key][0].find('> .array-key').css('outline', '').removeAttr('title');
                        }
                    }
                    
                    // Second pass: build the result object
                    $nestedContainer.find('> .array-row').each(function() {
                        const result = processRow($(this));
                        if (result) {
                            // Object.assign will naturally override duplicate keys with the latest value
                            Object.assign(nestedObj, result);
                        }
                    });
                    return { [trimmedKey]: nestedObj };
                }
            } else {
                // Regular key-value pair
                const trimmedKey = key.trim();
                // If key is empty, generate a unique key to prevent issues
                const finalKey = trimmedKey || `item_${Math.floor(Math.random() * 10000)}`;
                const trimmedValue = $value.val().trim();
                return trimmedValue || finalKey ? { [finalKey]: trimmedValue } : null;
            }
        }

        // Hidden field existence check already done above
        const jsonStr = JSON.stringify(result);
        $jsonField.val(jsonStr).trigger('change');
        
    }

    // Handle array inputs
    function resetArrayField($container) {
        $container.find('.array-row').remove();
        updateArrayField($container);
    }

    $(document).on('click', '.array-add', function(e) {
        e.preventDefault();
        const $container = $(this).closest('.array-inputs');
        const isNested = $(this).closest('.nested-array-container').length > 0;
        const $row = createArrayRow(isNested);
        
        // Check if we're in array mode and hide the key input if needed
        const $rootType = $container.closest('.form-field').find('.array-root-type');
        if ($rootType.length && $rootType.val() === 'array' && !isNested) {
            $row.find('.array-key').hide();
        }
        
        // Update nesting buttons visibility
        validateBodyField();
        
        $container.find('.array-buttons').before($row);
        updateArrayField($container);
    });

    $(document).on('click', '.array-remove', function(e) {
        e.preventDefault();
        const $row = $(this).closest('.array-row');
        const $container = $row.closest('.array-inputs');
        
        // Find and remove any nested containers that belong to this row
        const $childContainer = $row.next('.nested-array-container');
        if ($childContainer.length) {
            const $addSibling = $childContainer.next('.array-add-sibling');
            $childContainer.remove();
            $addSibling.remove();
        }
        
        // Remove the row itself
        $row.remove();
        
        // If this row was inside a nested container, check if it was the last one
        const $nestedContainer = $row.closest('.nested-array-container');
        if ($nestedContainer.length && $nestedContainer.find('.array-row').length === 0) {
            const $parentRow = $nestedContainer.prev('.array-row');
            const $addSibling = $nestedContainer.next('.array-add-sibling');
            $nestedContainer.remove();
            $addSibling.remove();
            if ($parentRow.length) {
                $parentRow.removeClass('has-children');
            }
        }
        
        updateArrayField($container);
    });

    // Add tooltip styling for better visibility
    $('<style>\n' +
        '[title] { position: relative; }\n' +
        '[title]:hover::after {\n' +
        '  content: attr(title);\n' +
        '  position: absolute;\n' +
        '  bottom: 100%;\n' +
        '  left: 0;\n' +
        '  background: rgba(0, 0, 0, 0.8);\n' +
        '  color: white;\n' +
        '  padding: 5px 10px;\n' +
        '  border-radius: 3px;\n' +
        '  white-space: nowrap;\n' +
        '  z-index: 10000;\n' +
        '}\n' +
    '</style>').appendTo('head');

    // Handle nested array button click
    $(document).on('click', '.array-nested', createNestedRow);
    
    function createNestedRow(e = null, $_parentRow = null) {
        if(e) e.preventDefault();
        const $parentRow = $_parentRow || $(this).closest('.array-row');
        let $nestedContainer = $parentRow.next('.nested-array-container');
        const $container = $parentRow.closest('.array-inputs');
        
        if (!$nestedContainer.length) {
            // Create new container if it doesn't exist
            $nestedContainer = $('<span class="nested-array-container"></span>');
            $parentRow.after($nestedContainer);
            $parentRow.addClass('has-children');
            
            // Show type toggle and hide value input
            $parentRow.find('.array-value').hide();
            $parentRow.find('.array-type-toggle').show();
        }

        // Add new row at the end of the container
        const $newRow = createArrayRow(true);
        const type = $parentRow.find('.array-type-toggle').val();
        
        // Hide key input if parent is array type
        if (type === 'array') {
            $newRow.find('> .array-key').hide();
        }
        
        $nestedContainer.append($newRow);
        updateArrayField($container);

        // Return the new row as jQuery object
        return $newRow;
    }

    // Handle array/object type toggle for nested items
    $(document).on('change', '.array-type-toggle', function() {
        const $row = $(this).closest('.array-row');
        const $container = $row.closest('.array-inputs');
        const $nestedContainer = $row.next('.nested-array-container');
        const type = $(this).val();
        
        // Show/hide key inputs based on type
        $nestedContainer.find('> .array-row > .array-key').toggle(type === 'object');
        
        updateArrayField($container);
    });
    
    // Handle root array/object type toggle
    $(document).on('change', '.array-root-type', function() {
        const $inputWrapper = $(this).closest('.form-field');
        const $container = $inputWrapper.find('.array-inputs');
        const isRootArray = $(this).val() === 'array';
        
        // Make sure the container has the field name
        if (!$container.data('field')) {
            // Try to get the field name from the hidden input
            const hiddenInputName = $inputWrapper.find('input[type="hidden"]').attr('name');
            if (hiddenInputName) {
                $container.data('field', hiddenInputName);
            } else {
                // Fallback: try to get field name from the form field class
                const fieldClass = $inputWrapper.attr('class');
                if (fieldClass) {
                    const matches = fieldClass.match(/api_tester_(\w+)_field/);
                    if (matches && matches[1]) {
                        $container.data('field', matches[1]);
                    }
                }
            }
        }
        
        // Toggle visibility of all top-level keys
        $container.find('> .array-row > .array-key').toggle(!isRootArray);
        
        // Handle key preservation when switching between modes
        if (isRootArray) {
            // When switching to array mode, save the current keys
            $container.find('> .array-row').each(function() {
                const $row = $(this);
                const $key = $row.find('> .array-key');
                const keyValue = $key.val().trim();
                
                // Save the original key if it's not empty and not already saved
                if (keyValue && !$key.data('original-key')) {
                    $key.data('original-key', keyValue);
                }
            });
        } else {
            // When switching to object mode, restore original keys if available
            $container.find('> .array-row').each(function() {
                const $row = $(this);
                const $key = $row.find('> .array-key');
                const originalKey = $key.data('original-key');
                
                if (originalKey) {
                    // Restore the original key
                    $key.val(originalKey);
                } else {
                    // If no original key is saved, generate a meaningful one
                    const value = $row.find('> .array-value').val().trim();
                    let newKey = value ? value.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 10) : 'item';
                    newKey = newKey + '_' + (Math.floor(Math.random() * 1000));
                    $key.val(newKey);
                }
            });
        }
        
        updateArrayField($container);
    });

    // Function to detect if data structure is an array or object
    function detectDataStructure($container) {
        // Check if all keys are numeric and sequential
        let isArray = true;
        let expectedIndex = 0;
        
        $container.find('> .array-row').each(function() {
            const key = $(this).find('> .array-key').val().trim();
            // If key is not a number or not the expected index, it's not an array
            if (isNaN(key) || parseInt(key) !== expectedIndex) {
                isArray = false;
                return false; // break the loop
            }
            expectedIndex++;
        });
        
        return isArray ? 'array' : 'object';
    }
    
    // Initialize array fields on page load
    $(document).ready(function() {
        $('.array-inputs').each(function() {
            const $container = $(this);
            // Try to find the parent form field or input wrapper
            const $formField = $container.closest('.form-field');
            const $inputWrapper = $formField.length ? $formField : $container.closest('.input-wrapper');
            
            // Make sure the container has the field name
            if (!$container.data('field')) {
                // First try to get it directly from the container's data attribute
                const dataField = $container.attr('data-field');
                if (dataField) {
                    $container.data('field', dataField);
                } else {
                    // Try to get the field name from the hidden input
                    const $hiddenInput = $inputWrapper.find('input[type="hidden"]');
                    if ($hiddenInput.length) {
                        const hiddenInputName = $hiddenInput.attr('name');
                        if (hiddenInputName) {
                            $container.data('field', hiddenInputName);
                        }
                    }
                }
            }
            
            // Apply the root type toggle effect
            const $rootType = $inputWrapper.find('.array-root-type');
            if ($rootType.length) {
                // Auto-detect if it should be array or object based on current structure
                if ($container.find('> .array-row').length > 0) {
                    const detectedType = detectDataStructure($container);
                    $rootType.val(detectedType);
                }
                
                const isRootArray = $rootType.val() === 'array';
                $container.find('> .array-row > .array-key').toggle(!isRootArray);
            }
            
            updateArrayField($container);
        });
    });

    // Add placeholder for title input
    $('.api-tester-form .form-field input[id="api_tester_title"]').attr('placeholder', 'Enter a title');
    
    // Display array field value in human-readable format
    function displayArrayFieldPreview( force_hide = true) {
        const $preview = $('#array_field_preview');
        if( $preview.is(":visible") && ! force_hide){
            $preview.hide();
        } else {
            $preview.show();
        }
    }

    // Update the content fo the array field preview
    function updateArrayFieldPreview(content){
        const $preview = $('#array_field_preview');
        console.log( content );
        const parsedValue = JSON.parse(content);
        const formattedValue = JSON.stringify(parsedValue, null, 4);
        $preview.find('pre').text(formattedValue);
    }

    // Handle click of the Preview button
    $(document).on('click', '.array-preview', function(e) {
        e.preventDefault();
        const $input = $(this).closest('.array-inputs').next('.array-text-value');
        updateArrayFieldPreview($input.val())
        displayArrayFieldPreview( false );
    });

    // Auto hide preview on edit
    $(document).on('change', '.array-text-value', function() {
        updateArrayFieldPreview($(this).val());
    });
    
    // Make sure array field updates when any array input changes
    $(document).on('change keyup', '.array-key, .array-value', function() {
        const $container = $(this).closest('.array-inputs');
        updateArrayField($container);
    });

    // Handle stream checkbox to show/hide filename
    function updateFilenameVisibility() {
        if ($streamField.prop('checked')) {
            $filenameField.css('display', 'flex');
        } else {
            $filenameField.hide();
        }
    }

    $streamField.on('change', updateFilenameVisibility);
    // Initial state
    updateFilenameVisibility();

    // Format response size slider value
    function formatBytes(bytes) {
        if (bytes >= 1073741824) return Math.round(bytes / 1073741824) + ' GB';
        if (bytes >= 1048576) return Math.round(bytes / 1048576) + ' MB';
        return bytes + ' bytes';
    }

    // Handle unlimited size checkbox
    $('.unlimited-size').on('change', function() {
        const $slider = $('#api_tester_limit_response_size');
        const $value = $slider.next('.range-value');
        if ($(this).prop('checked')) {
            $slider.prop('disabled', true);
            $value.text('Unlimited');
            $slider.val(null);
        } else {
            $slider.prop('disabled', false);
            $slider.trigger('input');
        }
    });
    

    // Update response size display
    $('#api_tester_limit_response_size').on('input', function() {
        $(this).next('.range-value').text(formatBytes(Math.round(parseFloat($(this).val()))));
    });

    // Initialize response size display
    $('#api_tester_limit_response_size').trigger('input');

    // Initialize filename visibility
    if ($streamField.prop('checked')) {
        $filenameField.css('display', 'flex');
    } else {
        $filenameField.hide();
    }

    // Initialize unlimited size checkbox
    $('.unlimited-size').trigger('change');

    // Package the form data
    function packageFormData( action ){
        const formData = new FormData($form[0]);
        formData.append('action', action);
        formData.append('_ajax_nonce', api_tester.nonce);
        
        // Explicitly handle checkbox states
        $form.find('input[type="checkbox"]').each(function() {
            const $checkbox = $(this);
            formData.set($checkbox.attr('name'), $checkbox.prop('checked') ? '1' : '0');
        });
        
        // Generate or use existing preset ID
        const currentPresetId = $form.attr('data-preset-id');
        presetId = currentPresetId || 'preset_' + Date.now();
        formData.append('preset_id', presetId);
        
        return formData;
    }

    // Handle running the API request
    $runButton.on('click', function(e) {
        e.preventDefault();

        setFormLoading(true, $(this));
        const formData = packageFormData( 'run_api_request' );

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (presetId && response.success && response.data.presets && response.data.presets[presetId] && response.data.presets[presetId].responses && response.data.presets[presetId].responses[0] && response.data.presets[presetId].responses[0].timestamp) {
                    api_tester.presets = response.data.presets;
                    populateResponse(response.data.presets[presetId].responses[0].timestamp, false);
                } else {
                    populateResponse('',false);
                    console.log( response);
                    alert('Error: Check console for details');
                }
                setFormLoading(false, $runButton);
            },
            error: function() {
                alert('Error: Failed to run API request');
                setFormLoading(false, $runButton);
            }
        });
        
    });

    // Handle preset saving
    $saveButton.on('click', function(e) {
        e.preventDefault();

        const formData = packageFormData( 'save_api_preset' );

        setFormLoading(true, $(this));
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    api_tester.presets = response.data.presets;
                    const presetTitle = api_tester.presets[presetId].title;

                    // Update preset buttons
                    const existingButton = $(`.api-preset[data-preset-id="${presetId}"]`);
                    if (existingButton.length) {
                        existingButton.text(presetTitle);
                    } else {
                        const $newButton = $('<button/>', {
                            'type': 'button',
                            'class': 'button button-secondary api-preset',
                            'data-preset-id': presetId,
                            text: presetTitle
                        });
                        $('.api-tester-presets').append($newButton);
                    }
                    update_form();
                    return;
                } else {
                    alert('Failed to save preset: ' + response.data.message);
                    setFormLoading(false);
                }
            },
            error: function() {
                alert('Failed to save preset. Please try again.');
                setFormLoading(false);
            }
        });
    });

    // Handle preset duplication
    $duplicateButton.on('click', function(e) {
        e.preventDefault();

        // Empty preset ID so a new one is created when packaging form data
        $form.attr('data-preset-id', '');

        // Set allow_incrementing_title flag... Because this isn't a property in Operator, 
        // it will be return empty when saved. Ensuring that this is only set when duplicating
        $('#api_tester_allow_incrementing_title').val('1');

        // Save the new preset
        $saveButton.trigger('click');
    });

    // Handle preset deletion
    $deleteButton.on('click', function(e) {
        e.preventDefault();
        if (!confirm('Are you sure you want to delete this preset?')) {
            return;
        }

        if (!presetId) {
            alert('No preset selected');
            return;
        }

        setFormLoading(true, $(this));
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'delete_api_preset',
                preset_id: presetId,
                _ajax_nonce: api_tester.nonce
            },
            success: function(response) {
                if (response.success) {
                    api_tester.presets = response.data.presets;
                    $(`.api-preset[data-preset-id="${presetId}"]`).remove();
                    $form.removeAttr('data-preset-id');
                    $form[0].reset();
                    $streamField.trigger('change');
                    update_active_form_visuals();
                    $('html, body').animate({ scrollTop: 0 }, 'smooth');
                    setFormLoading(false);
                } else {
                    alert('Failed to delete preset: ' + response.data.message);
                    setFormLoading(false);
                }
            },
            error: function() {
                alert('Error deleting preset');
                setFormLoading(false);
            }
        });
    });

    // Update active form visuals
    function update_active_form_visuals(responseTimestamp = '') {
        $('.api-preset').removeClass('active');
        $('.api-preset[data-preset-id="' + presetId + '"]').addClass('active');

        populateResponse(responseTimestamp);

        if(presetId) {
            $saveButton.val('Update Preset');
            $duplicateButton.show();
            $deleteButton.show();
        } else {
            $saveButton.val('Create Preset');
            $duplicateButton.hide();
            $deleteButton.hide();
        }
    }
    update_active_form_visuals();

    // Reset array inputs to initial state
    function resetArrayInputs() {
        $('#array_field_preview').hide();
        $('.array-inputs').each(function() {
            // Remove all array rows, nested containers, and their contents
            $(this).find('.array-row, .nested-array-container').remove();
            $(this).find('input[type="hidden"]').val('{}');
        });
    }

    // Handle array input focus/blur
    $(document).on('focus', '.array-key, .array-value', function() {
        const $row = $(this).closest('.array-row');
        $('.array-row').removeClass('active');
        $row.addClass('active');
    });

    $(document).on('blur', '.array-key, .array-value', function() {
        // Small delay to allow for focus on other inputs in the same row
        setTimeout(() => {
            const $row = $(this).closest('.array-row');
            if (!$row.find(':focus').length) {
                $row.removeClass('active');
            }
        }, 100);
    });

    // Handle preset button clicks
    $(document).on('click', '.api-preset', function() {
        // Update the current preset ID when clicking a preset button
        presetId = $(this).data('preset-id');
        if (!presetId) {
            // Clear form for new preset
            $form[0].reset();
            $form.removeAttr('data-preset-id');
            $deleteButton.hide();
            update_active_form_visuals();
            resetArrayInputs();
            return;
        }
        
        
        setFormLoading(true, $(this));
        populateResponse();
        update_form();
    });

    function update_form(){
        const data = api_tester.presets[presetId];

        // Update form fields
        // Reset form first
        $form.find('input[type="checkbox"]').prop('checked', false);
        $form.find('input[type="range"]').each(function() {
            $(this).val($(this).attr('min'));
            $(this).trigger('input');
        });
        
        // Clear all array fields
        $form.find('input.array-text-value').val('');
        $form.find('.array-inputs').each(function() {
            $(this).find('.array-row, .nested-array-container').remove();
        });

        // Handle unlimited size first to ensure proper range state
        const unlimitedValue = data['api_tester_unlimited_size'];
        const $unlimitedCheckbox = $('.unlimited-size');
        const isUnlimited = unlimitedValue === '1' || unlimitedValue === true || unlimitedValue === 'true' || unlimitedValue === 'on';
        $unlimitedCheckbox.prop('checked', isUnlimited);
        $unlimitedCheckbox.trigger('change');

        // Now update with preset values
        // First handle normal fields
        Object.entries(data).forEach(([key, value]) => {
            const $field = $form.find(`[name="${key}"]`);
            if (!$field.length) return;

            if ($field.is(':checkbox')) {
                const isChecked = value === '1' || value === true || value === 'true' || value === 'on';
                $field.prop('checked', isChecked);
                $field.trigger('change');
            } else if ($field.attr('type') === 'range') {
                $field.val(value);
                $field.trigger('input');
                // Update the range value display
                const $display = $field.next('.range-value');
                if ($display.length) {
                    if (key === 'api_tester_limit_response_size') {
                        $display.text(formatBytes(value));
                    } else {
                        $display.text(value);
                    }
                }
            } else if ($field.is('select')) {
                // For select elements, we need to set the value and trigger change
                $field.val(value).trigger('change');
            } else {
                value = convertJson(value, false);
                $field.val(value);
            }
        });

        // Then handle array fields
        $form.find('.array-inputs').each(function() {
            processArrayField($(this), data);
        });

        // Handle stream field last
        $streamField.trigger('change');
        $deleteButton.show();
        $form.attr('data-preset-id', presetId);
        update_active_form_visuals();
        setFormLoading(false);        
    }

// DEV: Working on reading in existing array data. It's only been showing [object Object] for the parent value of nested arrays. Gotta fix that.
    function processArrayField($field, data){
        const fieldName = $field.data('field');
        const key = 'api_tester_' + fieldName;
        $field.find('.array-row').remove();
        const rowData = data[fieldName];

        if (rowData) {
            try {
                let arrayData;
                // Change body fields that should be text to regular inputs
                if( fieldName === 'body' && data['content_type'] === 'text/plain' ){
                    arrayData = convertJson(rowData, false);
                    $field.find('.array-text-value').val(arrayData);
                    console.log( 'ERROR: This isn\'t reading in the text value? I suspect the save process.');
                    return;
                }
                // Handle object/array data for array fields
                else {
                    arrayData = convertJson(rowData, true);
                    Object.entries(arrayData).forEach(([k, v]) => {
                        processArrayRow($field, k, v);
                    });
                }
            } catch (e) {
                console.error('Error handling array data:', e);
            }
        }
        updateArrayField($field);
    }

    function processArrayRow($field, k, v, $parentRow = null){
        let $row;
        if( $parentRow ){
            $row = createNestedRow(null, $parentRow);
        }else{
            $row = createArrayRow();
            $field.find('.array-buttons').before($row);
        }

        if (k && k.trim()) {
            // Unescape array key and value if they're strings
            let key = k.trim();
            if (typeof key === 'string') {
                key = key.replace(/\\/g, '');
            }            
            $row.find('.array-key').val(key);

            let val = v || '';
            if( typeof val === 'string' ){
                val = val.replace(/\\/g, '');
                $row.find('.array-value').val(val);
            } else {
                // Determine if the value is an array or an object
                const childType = Array.isArray(val) ? 'array' : 'object';
                $row.find('> .array-type-toggle').val(childType);
                Object.entries(val).forEach(([k, v]) => {
                    processArrayRow($field, k, v, $row);
                });
            }
        }
    }

    /**
     * Toggle a string to JSON or vice versa, unless toJson is explicitly set
     * 
     * @param {string|object} data - The data to convert
     * @param {boolean|null} toJson - Whether to convert to JSON
     * @returns {string|object} - The converted data
     */
    function convertJson(data, toJson = null){
        if( toJson === null ){
            toJson = typeof data === 'string';
        }
        if( toJson ){
            if (typeof data === 'string') {
                // Handle potential double-encoded JSON
                try {
                    return JSON.parse(data);
                } catch (e1) {
                    try {
                        return JSON.parse(data.replace(/\\/g, ''));
                    } catch (e2) {
                        // It's just a string, return it in an array
                        return [data];
                    }
                }
            }
            // It's already a json object, return it
            return data;
        } else {
            if (typeof data === 'object') {
                // Convert the object to a string
                return JSON.stringify(data, null, 2);
            }
            // If not JSON, just unescape the string
            return data.replace(/\\/g, '');
        }
    }

    function processArrayValue( value ){
        return value;
    }

    function populateResponse(responseTimestamp = '', autoSelectFirst = true){
        responseTimestamp = confirmActiveResponseTimestamp(responseTimestamp);
        // If there's not a valid response timestamp, then there are no applicable responses
        if( ! responseTimestamp && ! autoSelectFirst){
            clearResponseTabs();
            clearResponseData();
            return;
        }
        populateTabs(responseTimestamp);
        populateResponseData(responseTimestamp);
    }

    function confirmActiveResponseTimestamp(responseTimestamp = ''){
        // Make sure we have something to work with
        const responses = getResponsesForPreset();
        if( ! responses.length ){
            return null;
        }

        // If no responseTimestamp is provided, return the first valid response
        if( ! responseTimestamp ){
            return responses[0].timestamp;
        } 
        // If responseTimestamp is provided, check if it exists in the preset's responses
        else {
            const response = responses.find(response => response.timestamp === responseTimestamp);
            if( response ){
                // Success return the provided timestamp
                return response.timestamp;
            }
        }

        // If no valid response was found, then return null
        return null;
    }

    function populateTabs(responseTimestamp){
        $responseTabs.empty();
        const responses = getResponsesForPreset();
        if( ! responses.length ){
            return;
        }

        // Get all responses for this preset
        responses.forEach(response => {
            const newTab = $('<input type="button" class="button api-response-tab" data-response-timestamp="' + response.timestamp + '" value="' + formatDateTime(response.timestamp) + '" />');
            $responseTabs.append(newTab);
        });

        activateTab(responseTimestamp);
    }

    function getResponsesForPreset(){
        if( ! presetId || ! api_tester.presets || ! api_tester.presets[presetId] || ! api_tester.presets[presetId].responses || ! api_tester.presets[presetId].responses.length ){
            return [];
        }
        return api_tester.presets[presetId].responses;
    }

    // Handle response tab clicks
    $(document).on('click', '.api-response-tab', function() {
        populateResponse($(this).data('response-timestamp'));
    });

    function activateTab(responseTimestamp){
        // Remove .active from all tabs
        $('.api-response-tab').removeClass('active');
        // Add .active to the selected tab
        $('.api-response-tab[data-response-timestamp="' + responseTimestamp + '"]').addClass('active');

        return responseTimestamp;
    }

    function clearResponseTabs(){
        $responseTabs.empty();
    }

    function populateResponseData(responseTimestamp){
        clearResponseData();
        
        // Get all inputs inside of the response tabs
        const responses = getResponsesForPreset();
        const response = responses.find(response => response.timestamp === responseTimestamp);
        if( response ){
            // populate divs
            $responseHeader.html('Status: ' + response.status_code);
            $responseBody.html(getResponseTableHtml(response.body, 'Response Body'));
            $responseArgs.html(getResponseTableHtml(response.args, 'Request Args'));
        }
    }

    function getResponseTableHtml(obj, heading = null){
        // Try parsing if it's a JSON string
        if (typeof obj === 'string') {
            try {
                obj = JSON.parse(obj);
            } catch (e) {
                // If it's not valid JSON, keep it as a string
            }
        }

        // Handle non-object values
        if (obj === null) return addCopyButton($('<span>null</span>'));
        if (typeof obj !== 'object') return addCopyButton($('<span></span>').text(String(obj)));

        const table = $('<table></table>');
        
        // Add heading if provided
        if (heading) {
            table.append($('<tr><th colspan="2">' + heading + '</th></tr>'));
        }

        for (const key in obj) {
            const row = $('<tr></tr>');
            const keyCell = $('<td class="key"></td>').text(key);
            const valueCell = $('<td class="value"></td>');
            
            let value = obj[key];
            
            // Try to parse string values as JSON
            if (typeof value === 'string') {
                try {
                    const parsed = JSON.parse(value);
                    if (typeof parsed === 'object' && parsed !== null) {
                        value = parsed;
                    }
                } catch (e) {}
            }

            if (value === null) {
                valueCell.text('null');
                addCopyButton(valueCell);
            } else if (typeof value === 'object') {
                // Recursively handle nested objects
                if( objectIsShallow(value) ){
                    valueCell.append(getResponseTableHtml(value));
                } else if( Array.isArray(value) ){
                    valueCell.append(getArrayHtml(value));
                } else {
                    valueCell.append(getObjectHtml(value));
                }
            } else {
                valueCell.text(String(value));
                addCopyButton(valueCell);
            }

            row.append(keyCell, valueCell);
            table.append(row);
        }
        return table;
    }

    function objectIsShallow(object){
        return Object.values(object).every(value => typeof value !== 'object' );
    }

    function getObjectHtml(values) {
        const list = $('<ul></ul>');
        Object.entries(values).forEach(([key, value]) => {
            const item = $('<li></li>');
            if( typeof value === 'object' ){
                item.html('<strong>' + key + '</strong>: ');
                if( Array.isArray(value) ){
                    item.append(getArrayHtml(value));
                } else {
                    item.append(getObjectHtml(value));
                }
            } else {
                item.html('<strong>' + key + '</strong>: ' + String(value));
                // addCopyButton(item, String(value));
            }
            list.append(item);
        });
        return list;
    }

    function getArrayHtml(values){
        const list = $('<ul></ul>');
        values.forEach(value => {
            const item = $('<li></li>');
            if( typeof value === 'object' ){
                if( Array.isArray(value) ){
                    item.append(getArrayHtml(value));
                } else {
                    item.append(getObjectHtml(value));
                }
            } else {
                item.html(String(value));
                // addCopyButton(item, String(value));
            }
            list.append(item);
        });
        return list;
    }

    function addCopyButton(element, copyText = null) {
        const copyIcon = $('<div class="copy-icon" title="Copy to clipboard"></div>');
        copyIcon.on('click', function() {
            const text = copyText || element.text();
            navigator.clipboard.writeText(text).then(() => {
                copyIcon.addClass('copied');
                setTimeout(() => {
                    copyIcon.removeClass('copied');
                }, 1500);
            });
        });
        element.append(copyIcon);
        return element;
    }

    function clearResponseData(){
        $responseHeader.html('');
        $responseBody.html('');
        $responseArgs.html('');
    } 

    function formatDateTime(timestamp) {
        // Convert seconds to milliseconds if needed
        const timestampMs = timestamp.toString().length === 10 ? timestamp * 1000 : timestamp;
        const dateTime = new Date(timestampMs);
        return dateTime.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: '2-digit'
        }) + ' ' + dateTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    }
});

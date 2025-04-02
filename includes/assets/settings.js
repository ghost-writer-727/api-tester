jQuery(document).ready(function($){
    // Initialize form elements
    const $form = $('.api-tester-form');
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
            <div class="array-row">
                <input type="text" class="array-key" placeholder="Key">
                <input type="text" class="array-value" placeholder="Value">
                <select class="array-type-toggle" style="display:none">
                    <option value="array">Array</option>
                    <option value="object">Object</option>
                </select>
                <button type="button" class="button-link array-nested" title="Add child item">
                    <span class="dashicons dashicons-plus"></span>
                </button>
                <button type="button" class="button-link array-remove">
                    <span class="dashicons dashicons-no-alt"></span>
                </button>
            </div>
        `);

        // Add event handler for when a nested container is added
        const updateValueVisibility = () => {
            const hasNested = $row.next('.nested-array-container').length > 0;
            $row.find('.array-value').toggle(!hasNested);
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
        const fieldName = $container.data('field');
        const $hidden = $container.closest('form').find(`input[name="${fieldName}"]`);
        const $rootType = $container.closest('.input-wrapper').find('.array-root-type');
        const isRootArray = $rootType.val() === 'array';
        
        // If root is array, hide all top-level keys
        $container.find('> .array-row .array-key').toggle(!isRootArray);
        
        let result;
        if (isRootArray) {
            result = [];
            $container.find('> .array-row').each(function() {
                const processed = processRow($(this));
                if (processed) {
                    result.push(Object.values(processed)[0]);
                }
            });
        } else {
            result = {};
            $container.find('> .array-row').each(function() {
                const processed = processRow($(this));
                if (processed) {
                    Object.assign(result, processed);
                }
            });
        }

        function processRow($row) {
            const key = $row.find('> .array-key').val();
            const $value = $row.find('> .array-value');
            const $nestedContainer = $row.next('.nested-array-container');
            const type = $row.find('> .array-type-toggle').val() || 'object';
            
            if (!key && !$nestedContainer.length) return null;
            
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
                    $nestedContainer.find('> .array-row').each(function() {
                        const result = processRow($(this));
                        if (result) {
                            Object.assign(nestedObj, result);
                        }
                    });
                    return { [trimmedKey]: nestedObj };
                }
            } else {
                // Regular key-value pair
                const trimmedKey = key.trim();
                const trimmedValue = $value.val().trim();
                return trimmedValue || trimmedKey ? { [trimmedKey]: trimmedValue } : null;
            }
        }

        if ($hidden.length === 0) {
            console.error('Hidden field not found for', fieldName);
            return;
        }

        const jsonStr = JSON.stringify(result);
        $hidden.val(jsonStr).trigger('change');

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
        $(this).before($row);
        updateArrayField($container);
    });

    $(document).on('click', '.array-remove', function(e) {
        e.preventDefault();
        const $row = $(this).closest('.array-row');
        const $container = $row.closest('.array-inputs');
        const $nestedContainer = $row.closest('.nested-array-container');
        const $parentRow = $nestedContainer.prev('.array-row');
        const $addSibling = $nestedContainer.next('.array-add-sibling');
        
        // Remove the row
        $row.remove();
        
        // If this was the last row in a nested container, remove the container and sibling button
        if ($nestedContainer.length && $nestedContainer.find('.array-row').length === 0) {
            $nestedContainer.remove();
            $addSibling.remove();
            if ($parentRow.length) {
                $parentRow.removeClass('has-children');
            }
        }
        
        updateArrayField($container);
    });

    $(document).on('change keyup', '.array-key, .array-value', function() {
        const $container = $(this).closest('.array-inputs');
        updateArrayField($container);
    });

    // Handle nested array button click
    $(document).on('click', '.array-nested', function(e) {
        e.preventDefault();
        const $row = $(this).closest('.array-row');
        let $nestedContainer = $row.next('.nested-array-container');
        const $container = $row.closest('.array-inputs');
        
        if (!$nestedContainer.length) {
            // Create new container if it doesn't exist
            $nestedContainer = $('<div class="nested-array-container"></div>');
            $row.after($nestedContainer);
            $row.addClass('has-children');
            
            // Show type toggle and hide value input
            $row.find('.array-value').hide();
            $row.find('.array-type-toggle').show();
        }

        // Add new row at the end of the container
        const $newRow = createArrayRow(true);
        const type = $row.find('.array-type-toggle').val();
        
        // Hide key input if parent is array type
        if (type === 'array') {
            $newRow.find('.array-key').hide();
        }
        
        $nestedContainer.append($newRow);
        updateArrayField($container);
    });
    
    // Handle array/object type toggle for nested items
    $(document).on('change', '.array-type-toggle', function() {
        const $row = $(this).closest('.array-row');
        const $container = $row.closest('.array-inputs');
        const $nestedContainer = $row.next('.nested-array-container');
        const type = $(this).val();
        
        // Show/hide key inputs based on type
        $nestedContainer.find('.array-key').toggle(type === 'object');
        
        updateArrayField($container);
    });
    
    // Handle root array/object type toggle
    $(document).on('change', '.array-root-type', function() {
        const $container = $(this).closest('.input-wrapper').find('.array-inputs');
        updateArrayField($container);
    });

    // Initialize array fields on page load
    $(document).ready(function() {
        $('.array-inputs').each(function() {
            updateArrayField($(this));
        });
    });

    // Add placeholder for title input
    $('.api-tester-form .form-field input[id="api_tester_title"]').attr('placeholder', 'Enter a title');

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
        $('.array-inputs').each(function() {
            $(this).find('.array-row, .nested-array-container').remove();
            $(this).find('input[type="hidden"]').val('{}');
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
                // Try to unescape string values for text fields
                if (typeof value === 'string') {
                    try {
                        // First try to parse as JSON in case it's a stringified object/array
                        const parsed = JSON.parse(value);
                        if (typeof parsed === 'object') {
                            value = JSON.stringify(parsed, null, 2);
                        }
                    } catch (e) {
                        // If it's not JSON, unescape the string
                        value = value.replace(/\\/g, '');
                    }
                }
                $field.val(value);
            }
        });

        // Then handle array fields
        $('.array-inputs').each(function() {
            const fieldName = $(this).data('field');
            const key = 'api_tester_' + fieldName;
            $(this).find('.array-row').remove();

            if (data[fieldName]) {
                try {
                    let arrayData;
                    if (typeof data[fieldName] === 'string') {
                        // Handle potential double-encoded JSON
                        try {
                            arrayData = JSON.parse(data[fieldName]);
                        } catch (e1) {
                            try {
                                arrayData = JSON.parse(data[fieldName].replace(/\\/g, ''));
                            } catch (e2) {
                                arrayData = {};
                            }
                        }
                    } else {
                        arrayData = data[fieldName];
                    }

                    if (arrayData && typeof arrayData === 'object') {
                        Object.entries(arrayData).forEach(([k, v]) => {
                            if (k && k.trim()) {
                                const $row = createArrayRow();
                                // Unescape array key and value if they're strings
                                let key = k.trim();
                                let val = v || '';
                                
                                if (typeof key === 'string') {
                                    key = key.replace(/\\/g, '');
                                }
                                
                                if (typeof val === 'string') {
                                    try {
                                        // Try to parse as JSON first
                                        const parsed = JSON.parse(val);
                                        if (typeof parsed === 'object') {
                                            val = JSON.stringify(parsed, null, 2);
                                        }
                                    } catch (e) {
                                        // If not JSON, just unescape the string
                                        val = val.replace(/\\/g, '');
                                    }
                                }
                                
                                $row.find('.array-key').val(key);
                                $row.find('.array-value').val(val);
                                $(this).find('.array-add').before($row);
                            }
                        });
                    }
                } catch (e) {
                    console.error('Error handling array data:', e);
                }
            }
            updateArrayField($(this));
        });

        // Handle stream field last
        $streamField.trigger('change');
        $deleteButton.show();
        $form.attr('data-preset-id', presetId);
        update_active_form_visuals();
        setFormLoading(false);        
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
            console.log('getResponsesForPreset: No valid responses found for preset: ' + presetId, api_tester.presets);
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
            $responseBody.html(getObjectHtml(response.body, 'Response Body'));
            $responseArgs.html(getObjectHtml(response.args, 'Request Args'));
        }
    }

    function getObjectHtml(obj, heading = null){
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
                valueCell.append(getObjectHtml(value));
            } else {
                valueCell.text(String(value));
                addCopyButton(valueCell);
            }

            row.append(keyCell, valueCell);
            table.append(row);
        }
        return table;
    }

    function addCopyButton(element) {
        const copyIcon = $('<div class="copy-icon" title="Copy to clipboard"></div>');
        copyIcon.on('click', function() {
            const text = element.text();
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

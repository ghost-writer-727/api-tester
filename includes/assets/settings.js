jQuery(document).ready(function($){
    // Add overlay div to form
    const $formOverlay = $('<div class="api-tester-form-overlay"></div>');
    $('.api-tester-form').append($formOverlay);

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
    function createArrayRow() {
        return $(`
            <div class="array-row">
                <input type="text" class="array-key" placeholder="Key">
                <input type="text" class="array-value" placeholder="Value">
                <button type="button" class="button-link array-remove">
                    <span class="dashicons dashicons-no-alt"></span>
                </button>
            </div>
        `);
    }

    function updateArrayField($container) {
        const fieldName = $container.data('field');
        // Look for the hidden input in the parent form using just the field name
        const $hidden = $container.closest('form').find(`input[name="${fieldName}"]`);
        const data = {};

        $container.find('.array-row').each(function() {
            const key = $(this).find('.array-key').val();
            const value = $(this).find('.array-value').val();
            if (key && key.trim()) {
                data[key.trim()] = value || '';
            }
        });

        if ($hidden.length === 0) {
            console.error('Hidden field not found for', fieldName);
            return;
        }

        const jsonStr = JSON.stringify(data);
        $hidden.val(jsonStr).trigger('change');
    }

    // Handle array inputs
    function resetArrayField($container) {
        $container.find('.array-row').remove();
        updateArrayField($container);
    }

/*    function populateArrayField($container, data) {
        resetArrayField($container);
        if (!data) return;

        try {
            const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
            Object.entries(parsedData).forEach(([key, value]) => {
                const $row = createArrayRow();
                $row.find('.array-key').val(key);
                $row.find('.array-value').val(value);
                $container.find('.array-add').before($row);
            });
            updateArrayField($container);
        } catch (e) {
            console.error('Error parsing array field data:', e);
        }
    }
*/
    $(document).on('click', '.array-add', function(e) {
        e.preventDefault();
        const $container = $(this).closest('.array-inputs');
        const $row = createArrayRow();
        $(this).before($row);
        updateArrayField($container);
    });

    $(document).on('click', '.array-remove', function(e) {
        e.preventDefault();
        const $container = $(this).closest('.array-inputs');
        $(this).closest('.array-row').remove();
        updateArrayField($container);
    });

    $(document).on('change keyup', '.array-key, .array-value', function() {
        const $container = $(this).closest('.array-inputs');
        updateArrayField($container);
    });

    // Initialize array fields on page load
    $(document).ready(function() {
        $('.array-inputs').each(function() {
            updateArrayField($(this));
        });
    });

    // Initialize form elements
    const $form = $('.api-tester-form');
    const $runButton = $('.api-tester-run');
    const $saveButton = $('.api-tester-save');
    const $duplicateButton = $('.api-tester-duplicate');
    const $deleteButton = $('.api-tester-delete');
    const $streamField = $('#api_tester_stream');
    const $filenameField = $('.form-field.api_tester_filename_field');
    const $responseField = $('.api-response');

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
        const presetId = currentPresetId || 'preset_' + Date.now();
        formData.append('preset_id', presetId);
        
        return formData;
    }

    // Handle running the API request
    $runButton.on('click', function(e) {
        e.preventDefault();

        setFormLoading(true, $(this));
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: packageFormData( 'run_api_request' ),
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    $responseField.html(response.data.html).show();
                } else {
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

        setFormLoading(true, $(this));
        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: packageFormData( 'save_api_preset' ),
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    const presetId = response.data.preset_id;
                    const presetTitle = response.data.title;
                    
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
                    
                    api_tester.presets[presetId] = response.data;
                    update_form(presetId);
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

        // Generate a new preset ID
        const newPresetId = 'preset_' + Date.now();
        $form.attr('data-preset-id', newPresetId);

        // Set allow_incrementing_title flag
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
        const presetId = $form.attr('data-preset-id');
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
                    $(`.api-preset[data-preset-id="${presetId}"]`).remove();
                    $form.removeAttr('data-preset-id');
                    $form[0].reset();
                    $streamField.trigger('change');
                    $deleteButton.hide();
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
    function update_active_form_visuals(presetId = '') {
        $('.api-preset').removeClass('active');
        $('.api-preset[data-preset-id="' + presetId + '"]').addClass('active');
        $responseField.hide().empty();

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
            $(this).find('.array-row').remove();
            $(this).find('input[type="hidden"]').val('{}');
        });
    }

    // Handle preset button clicks
    $(document).on('click', '.api-preset', function() {
        const presetId = $(this).data('preset-id');
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
        update_form(presetId);
    });

    function update_form(presetId){
        const data = api_tester.presets[presetId];

        // Update form fields
        // Reset form first
        $form.find('input[type="checkbox"]').prop('checked', false);
        $form.find('input[type="range"]').each(function() {
            $(this).val($(this).attr('min'));
            $(this).trigger('input');
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
        update_active_form_visuals(presetId);
        setFormLoading(false);        
    }
});

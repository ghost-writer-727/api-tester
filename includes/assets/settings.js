jQuery(document).ready(function($){
    // Add placeholder for title input
    $('.api-tester-form .form-field input[id="api_tester_title"]').attr('placeholder', 'Enter a title');

    // Handle stream checkbox to show/hide filename
    $(document).on('change', '#api_tester_stream', function() {
        const $field = $('.form-field.api_tester_filename_field');
        if ($(this).prop('checked')) {
            $field.css('display', 'flex');
        } else {
            $field.hide();
        }
    });

    // Format response size slider value
    function formatBytes(bytes) {
        if (bytes >= 1073741824) return Math.round(bytes / 1073741824) + ' GB';
        if (bytes >= 1048576) return Math.round(bytes / 1048576) + ' MB';
        return bytes + ' bytes';
    }

    // Handle unlimited size checkbox
    $(document).on('change', '.unlimited-size', function() {
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
    $(document).on('input', '#api_tester_limit_response_size', function() {
        $(this).next('.range-value').text(formatBytes(Math.round(parseFloat($(this).val()))));
    });

    // Initialize response size display
    $('#api_tester_limit_response_size').trigger('input');

    // Update slider value when preset loads
    $(document).on('preset:loaded', function() {
        $('#api_tester_limit_response_size').trigger('input');
    });

    // Initialize filename visibility
    const $field = $('.form-field.api_tester_filename_field');
    if ($('#api_tester_stream').prop('checked')) {
        $field.css('display', 'flex');
    } else {
        $field.hide();
    }

    // Initialize unlimited size checkbox
    $('.unlimited-size').trigger('change');

    // Handle saving and updating presets
    $(document).on('click', '.api-tester-save', function(e) {
        e.preventDefault();
        const $form = $(this).closest('form');
        const presetId = $form.data('preset-id') || Date.now().toString();
        const formData = {};

        // Collect all form data
        $form.find('input[type="text"], input[type="hidden"], input[type="checkbox"]').each(function() {
            const $input = $(this);
            const name = $input.attr('name');
            if (!name) return;

            if ($input.attr('type') === 'checkbox') {
                // Only include checkbox if it's checked
                if ($input.prop('checked')) {
                    formData[name] = true;
                } else {
                    formData[name] = false;
                }
            } else {
                let value = $input.val();
                // Try to parse JSON for array fields
                try {
                    value = JSON.parse(value);
                } catch (e) {
                    // If not JSON, use as is
                }
                formData[name] = value;
            }
        });

        // Add metadata
        formData.id = presetId;
        formData.updated = Date.now();
        if (!formData.created) {
            formData.created = formData.updated;
        }

        // Save via AJAX
        $.ajax({
            url: ajaxurl,
            method: 'POST',
            data: {
                action: 'save_api_preset',
                preset: formData,
                nonce: api_tester.nonce
            },
            success: function(response) {
                if (response.success) {
                    location.reload();
                } else {
                    alert('Error saving preset: ' + response.data);
                }
            },
            error: function( jqXHR, textStatus, errorThrown ) {
                alert('Error saving preset');
                console.log( jqXHR, textStatus, errorThrown );
            }
        });
    });

    // Delete preset
    $(document).on('click', '.api-tester-delete', function(e) {
        e.preventDefault();
        const $form = $('.api-tester-form');
        const presetId = $form.attr('data-preset-id');

        if (!presetId) {
            alert('No preset selected');
            return;
        }

        if (!confirm('Are you sure you want to delete this preset?')) {
            return;
        }

        $.ajax({
            url: ajaxurl,
            type: 'POST',
            data: {
                action: 'delete_api_preset',
                nonce: api_tester.nonce,
                preset_id: presetId
            },
            success: function(response) {
                if (response.success) {
                    // Remove preset from list and reset form
                    $(`.api-preset[data-preset-id="${presetId}"]`).remove();
                    $form.attr('data-preset-id', '');
                    $('.api-tester-delete').hide();
                    update_active_form_visuals();
                } else {
                    alert('Error deleting preset: ' + response.data);
                }
            },
            error: function() {
                alert('Error deleting preset');
            }
        });
    });

    // Load preset when clicked
    $(document).on('click', '.api-preset', function(e) {
        e.preventDefault();
        const presetId = $(this).data('preset-id');
        
        if (!presetId) {
            location.reload(); // For new preset button
            return;
        }

        $.ajax({
            url: ajaxurl,
            method: 'POST',
            data: {
                action: 'load_api_preset',
                preset_id: presetId,
                nonce: api_tester.nonce
            },
            success: function(response) {
                if (response.success) {
                    const preset = response.data;
                    const $form = $('.api-tester-form');
                    
                    // Update form with preset data
                    Object.entries(preset).forEach(([key, value]) => {
                        const $input = $form.find(`[name="${key}"]`);
                        if (!$input.length) return;

                        if ($input.attr('type') === 'checkbox') {
                            value = value === 'true' || value === true;
                            // Update filename visibility if this is the stream checkbox
                            if (key === 'stream') {
                                const $field = $('.form-field.api_tester_filename_field');
                                if (value) {
                                    $field.css('display', 'flex');
                                } else {
                                    $field.hide();
                                }
                            }
                            $input.prop('checked', value);
                        } else if (typeof value === 'object') {
                            $input.val(JSON.stringify(value));
                            // Rebuild array inputs
                            const $container = $input.closest('.array-inputs');
                            if ($container.length) {
                                $container.find('.array-row').remove();
                                Object.entries(value).forEach(([k, v]) => {
                                    const $row = createArrayRow();
                                    $row.find('.array-key').val(k);
                                    $row.find('.array-value').val(v);
                                    $container.find('.array-add').before($row);
                                });
                            }
                        } else {
                            $input.val(value);
                        }
                    });

                    $form.attr('data-preset-id', presetId);
                    // Update slider value display
                    $('#api_tester_limit_response_size').trigger('input');
                    // Show delete button and update visuals
                    $('.api-tester-delete').show();
                    update_active_form_visuals(presetId);
                } else {
                    alert('Error loading preset: ' + response.data);
                }
            },
            error: function() {
                alert('Error loading preset');
            }
        });
    });

    // Handle array inputs
    function updateArrayField($container) {
        const fieldName = $container.data('field');
        const $hidden = $container.find(`input[name="${fieldName}"]`);
        const data = {};

        $container.find('.array-row').each(function() {
            const key = $(this).find('.array-key').val();
            const value = $(this).find('.array-value').val();
            if (key) {
                data[key] = value;
            }
        });

        $hidden.val(JSON.stringify(data));
    }

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

    // Add new array item
    $(document).on('click', '.array-add', function(e) {
        e.preventDefault();
        const $container = $(this).closest('.array-inputs');
        const $row = createArrayRow();
        $(this).before($row);
        updateArrayField($container);
    });

    // Remove array item
    $(document).on('click', '.array-remove', function(e) {
        e.preventDefault();
        const $container = $(this).closest('.array-inputs');
        $(this).closest('.array-row').remove();
        updateArrayField($container);
    });

    // Update hidden field when array inputs change
    $(document).on('input', '.array-key, .array-value', function() {
        const $container = $(this).closest('.array-inputs');
        updateArrayField($container);
    });

    // Update active form visuals
    function update_active_form_visuals(presetId = '') {
        $('.api-preset').removeClass('active');
        $('.api-preset[data-preset-id="' + presetId + '"]').addClass('active');

        if(presetId) {
            $('.api-tester-form[data-preset-id="' + presetId + '"] .api-tester-save').val('Update Preset');
        }
    }
    update_active_form_visuals();
});

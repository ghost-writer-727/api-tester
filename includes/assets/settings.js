jQuery(document).ready(function($){
    // Add placeholder for title input
    $('.api-tester-form .form-field input[id="api_tester_title"]').attr('placeholder', 'Enter a title');

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

jQuery(document).ready(function($){
    // Add placeholder for title input
    $('.api-tester-form .form-field input[id="api_tester_title"]').attr('placeholder', 'Enter a title');

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

jQuery(document).ready(function($){
    

    // add a placeholder for .api-tester-form .form-field input[id="api_tester_title"]
    $('.api-tester-form .form-field input[id="api_tester_title"]').attr('placeholder', 'Enter a title');

    function update_active_form_visuals( presetId = '' ){
        $('.api-preset').removeClass('active');
        $('.api-preset[data-preset-id="' + presetId + '"]').addClass('active');

        if( presetId ){
            $('.api-tester-form[data-preset-id="' + presetId + '"] .api-tester-save').val('Update Preset');
        }
    }
    update_active_form_visuals();
});

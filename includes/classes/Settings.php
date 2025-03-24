<?php namespace API_Tester;
defined( 'ABSPATH' ) || exit;

class Settings{ 
    private static $instance;
    private $default_operator;

    /**
     * Store a different set of settings as a separate option and load all sets of settings into one array
     * 
     * @var array
     */
    private array $presets;

    public static function get_instance(){
        if( ! self::$instance ){
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct(){
        $this->default_operator = new Operator();
        $this->presets = get_option(Main::SLUG . '_presets', []);
        
        add_action('admin_menu', [$this, 'register_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'admin_enqueue_scripts']);
        add_action('wp_ajax_run_api_request', [$this, 'handle_run_api_request']);
        add_action('wp_ajax_save_api_preset', [$this, 'handle_save_preset']);
        add_action('wp_ajax_load_api_preset', [$this, 'handle_load_preset']);
        add_action('wp_ajax_delete_api_preset', [$this, 'handle_delete_preset']);
    }

    /**
     * Register the admin menu page
     */
    public function register_admin_menu() {
        add_menu_page(
            Main::NAME,
            Main::NAME,
            'manage_options',
            Main::SLUG,
            [$this, 'render_settings_page'],
            'dashicons-rest-api',
            55
        );
    }

    /**
     * Render the settings page content
     */
    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <div class="api-tester">
                <div class="api-presets">
                    <h2>Presets</h2>
                    <div class="api-tester-presets">
                        <button type="button" class="button button-secondary api-preset" data-preset-id="">New +</button>
                        <?php foreach( $this->presets as $preset_id => $preset ) {
                            $title = isset($preset['title']) ? $preset['title'] : 'Untitled Preset';
                            echo '<button type="button" class="button button-secondary api-preset" data-preset-id="' . esc_attr($preset_id) . '">' . esc_html($title) . '</button>';
                        } ?>
                    </div>
                </div>
                <div class="api-settings">
                    <?php echo $this->get_settings_html(); ?>
                    <?php echo $this->get_responses_html(); ?>
                </div>
            </div>
        </div>
        <?php
    }

    /**
     * Enqueue admin scripts
     */
    public function admin_enqueue_scripts() {
        $path = Main::DIR . '/includes/assets/';
        $url = Main::get_dir_url() . '/includes/assets/';
        wp_enqueue_style(
            'api-tester-admin', 
            $url . 'settings.css',
            [],
            filemtime($path . 'settings.css')
        );
        wp_enqueue_script(
            'api-tester-admin', 
            $url . 'settings.js', 
            ['jquery'], 
            filemtime($path . 'settings.js'), 
            true
        );
        wp_localize_script('api-tester-admin', 'api_tester', [
            'nonce' => wp_create_nonce('api_tester_nonce'),
            'presets' => $this->presets
        ]);
    }

    /**
     * Generate HTML settings fields for Operator properties
     * 
     * @param string|null $id ID of the settings preset to load
     * @return string HTML output
     */
    public function get_settings_html($id = null) {
        // If no ID provided, use the default operator instance
        $operator = $id === null ? $this->default_operator : new Operator();
        
        $html = '<form class="api-tester-form" data-preset-id="' . esc_attr($id) . '">';
        foreach ($operator->get_args() as $name => $value) {
            $field_id = 'api_tester_' . $name;
            
            // Get tooltip text based on field name
            $tooltip = $this->get_field_tooltip($name);
            $html .= '<p class="form-field ' . esc_attr($field_id) . '_field">';
            $html .= '<label for="' . esc_attr($field_id) . '">' . 
                     esc_html(ucfirst(str_replace('_', ' ', $name))) . 
                     ($tooltip ? ' <span class="woocommerce-help-tip" data-tip="' . esc_attr($tooltip) . '"></span>' : '') . 
                     '</label>';
            
            // Handle different types of values
            if ($name === 'method') {
                $methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
                $html .= '<select id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '">';
                foreach ($methods as $method) {
                    $html .= '<option value="' . $method . '"' . ($value === $method ? ' selected' : '') . '>' . $method . '</option>';
                }
                $html .= '</select>';
            } elseif( $name === 'body_format' ){
                $html .= '<select id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '">';
                $html .= '<option value="json"' . ($value === 'json' ? ' selected' : '') . '>JSON</option>';
                $html .= '<option value="array"' . ($value === 'array' ? ' selected' : '') . '>Array</option>';
                $html .= '</select>';
            } elseif ($name === 'httpversion') {
                $html .= '<select id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '">';
                $html .= '<option value="1.0"' . ($value === '1.0' ? ' selected' : '') . '>1.0</option>';
                $html .= '<option value="1.1"' . ($value === '1.1' ? ' selected' : '') . '>1.1</option>';
                $html .= '</select>';
            } elseif ($name === 'limit_response_size') {
                $min = 1024 * 1024; // 1MB
                $max = 1024 * 1024 * 1024; // 1GB
                $html .= '<span class="response-size-wrapper">';
                $html .= '<input type="range" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" '
                    . 'min="' . $min . '" max="' . $max . '" step="1048576" value="' . (int)$value . '"' .
                    ($value === null ? ' disabled' : '') . '>';
                $html .= '<span class="range-value"></span>';
                $html .= '<label class="unlimited-label"><input type="checkbox" name="api_tester_unlimited_size" class="unlimited-size"' . 
                    ($value === null ? ' checked' : '') . '>Unlimited</label>';
                $html .= '</span>';
            } elseif ($name === 'filename') {
                $html .= '<input type="text" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '">';
            } elseif (is_bool($value)) {
                $html .= '<input type="checkbox" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '"' . 
                        ($value ? ' checked="checked"' : '') . '>';
            } elseif (is_array($value)) {
                $html .= '<span class="input-wrapper"><span class="array-inputs" data-field="' . esc_attr($name) . '">';
                if (!empty($value)) {
                    foreach ($value as $k => $v) {
                        $html .= '<span class="array-row">';
                        $html .= '<input type="text" class="array-key" value="' . esc_attr($k) . '" placeholder="Key">';
                        $html .= '<input type="text" class="array-value" value="' . esc_attr($v) . '" placeholder="Value">';
                        $html .= '<button type="button" class="button-link array-remove"><span class="dashicons dashicons-no-alt"></span></button>';
                        $html .= '</span>';
                    }
                }
                $html .= '<button type="button" class="button array-add">Add Item</button>';
                $html .= '<input type="hidden" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" value="' . esc_attr(json_encode($value)) . '">';
                $html .= '</span></span>';
            } elseif (is_numeric($value)) {
                $html .= '<input type="number" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" value="' . 
                        esc_attr($value) . '" class="numeric-input">';
            } else {
                $html .= '<input type="text" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" value="' . 
                        esc_attr($value) . '">';
            }
            
            $html .= '</p>';
        }
        
        $html .= '<input type="hidden" id="api_tester_allow_incrementing_title" name="allow_incrementing_title" value="0">';
        $html .= '<p class="api-tester-buttons">';
        $html .= '<input type="button" value="Run Test" class="button button-primary api-tester-run">';
        $html .= '<input type="button" value="Create Preset" class="button button-secondary api-tester-save">';
        $html .= '<input type="button" value="Create New From This" class="button button-secondary api-tester-duplicate" style="display:none;">';
        $html .= '<input type="button" value="Delete Preset" class="button button-secondary api-tester-delete" style="display:none;">';
        $html .= '</p>';
        $html .= '</form>';
        
        return $html;
    }

    private function get_responses_html($preset_id = null, $response_timestamp = null){
        $html = '<div class="api-results">';
        
        foreach( $this->presets as $preset_id => $preset ){
            // If a preset id is specified, only show that preset
            if( $preset_id !== null and $preset_id !== $preset_id ){
                continue;
            }

            // If there are no responses, skip this preset
            if( ! isset( $preset['responses'] ) || empty( $preset['responses'] )){
                continue;
            }
            
            // Create a div for the preset
            $html .= '<div class="api-results-group" data-preset-id="' . esc_attr($preset_id) . '">';

            // Hold all the response tabs for each id in it's own div
            $html .= '<div class="api-response-tabs">';
            foreach( $preset['responses'] as $key => $response){
                // If a response timestamp is specified, only show that response
                if( $response_timestamp !== null and $response_timestamp !== $response['timestamp'] ){
                    continue;
                }
                $html .= $this->get_response_tab($key, $response);
            }
            $html .= '</div> <!-- End Response Tabs -->';

            // Hold all the responses for each id in it's own div
            $html .= '<div class="api-responses">';
            foreach( $preset['responses'] as $response ){
                // If a response timestamp is specified, only show that response
                if( $response_timestamp !== null and $response_timestamp !== $response['timestamp'] ){
                    continue;
                }
                // We use the timestamp as the response id, so it is required.
                if( ! isset( $response['timestamp'] )){
                    continue;
                }
                // Create a div with class api-response
                $html .= '<div class="api-response" data-preset-id="' . esc_attr($preset_id) . '" data-response-timestamp="' . esc_attr($response['timestamp']) . '">';
                
                // Create section header with the status code and date
                $html .= '<div class="api-response-header">' . $this->get_response_header($response) . '</div>';

                // Create a section for the response body
                // $html .= '<p class="api-response-show-response show-hide-wrapper" data-show-hide="api-response-body" data-show-hide-group="api-response"><span class="show-hide-toggle">Hide</span> Response Body</p>';
                $html .= '<div class="api-response-body">' . $this->get_response_body($response) . '</div>';

                // Create a section for the args
                // $html .= '<p class="api-response-show-args show-hide-wrapper" data-show-hide="api-response-args" data-show-hide-group="api-response"><span class="show-hide-toggle">Show</span> Request Args</p>';
                $html .= '<div class="api-response-args" style="display: none;">' . $this->get_response_args($response) . '</div>';

                // Create a section for full details
                // $html .= '<p class="api-response-show-details show-hide-wrapper" data-show-hide="api-response-details" data-show-hide-group="api-response"><span class="show-hide-toggle">Show</span> Full Details</p>';
                $html .= '<div class="api-response-details" style="display: none;">' . $this->get_response_details($response) . '</div>';

                $html .= '</div> <!-- End Response ID: ' . esc_attr($response['timestamp']) . ' -->';
            }
            $html .= '</div> <!-- End Responses -->';
            $html .= '</div> <!-- End Results Group for Preset ID: ' . esc_attr($preset_id) . ' -->';
        }
        $html .= '</div> <!-- End Results -->';
        return $html;
    }

    private function get_response_tab($key, $response){
        $id = $response['timestamp'];
        $html = '<input type="button" class="button api-response-tab" data-response-timestamp="' . esc_attr($id) . '" value="' . esc_html($key) . '" />';
        return $html;
    }

    private function get_response_header($response){
        $status = isset($response['status_code']) ? esc_html($response['status_code']) : 'Unknown';
        $date_time = date('M d, Y H:i', $response['timestamp']);
        $html = '<div class="api-response-status">' . $status . '</div>';
        $html .= '<div class="api-response-time">' . $date_time . '</div>';
        return $html;
    }

    private function get_response_body($response){
        $body = isset($response['body']) ? '<pre>' . print_r($response['body'],true) . '</pre>' : '';
        return $body;
    }

    private function get_response_args($response){
        $args = isset($response['args']) ? '<pre>' . print_r($response['args'], true) . '</pre>' : '';
        return $args;
    }

    private function get_response_details($response){
        $details = '<pre>' . print_r($response, true) . '</pre>';
        return $details;
    }

    /**
     * Handle running an API call
     */
    public function handle_run_api_request() {
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Insufficient permissions']);
        }

        if (!check_ajax_referer('api_tester_nonce', '_ajax_nonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce']);
        }

        $api = new Operator();
        $api->set_args( $_POST );
        $response = $api->request();

        if (!$response) {
            wp_send_json_error(['message' => 'JS Error: Failed to run API request']);
        }

        // Store the response
        $preset_id = isset($_POST['preset_id']) ? sanitize_text_field($_POST['preset_id']) : '';
        if( $preset_id ){
            $this->store_response( $preset_id, $response );
        }

        // Return the response
        wp_send_json_success(['details' => "<pre>" . print_r( $response, true ) . "</pre>" ]);
    }

    /**
     * Handle saving a preset via AJAX
     */
    public function handle_save_preset() {
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Insufficient permissions']);
        }

        if (!check_ajax_referer('api_tester_nonce', '_ajax_nonce', false)) {
            wp_send_json_error(['message' => 'Invalid nonce']);
        }

        // Get the preset data from POST
        $preset_id = isset($_POST['preset_id']) ? sanitize_text_field($_POST['preset_id']) : '';
        if (!$preset_id) {
            wp_send_json_error(['message' => 'JS Error: Preset ID missing']);
        }

        if (!isset($_POST['title'])) {
            wp_send_json_error(['message' => 'Title is required']);
        }

        $allow_incrementing_title = isset($_POST['allow_incrementing_title']) && $_POST['allow_incrementing_title'] === '1';
        $title = $_POST['title'] ?? '';
        $title = $this->validate_title($preset_id, $title, $allow_incrementing_title);
        if( !$title ) {
            wp_send_json_error(['message' => 'Title already exists']);
        }
        
        // Save the preset with title
        $preset_data = $_POST;
        $preset_data['title'] = $title;

        // Convert property values to correct types and sanitize
        foreach( $this->default_operator->get_public_property_names() as $property_name ){
            // Skip the ones that are not set
            if( !isset( $preset_data[ $property_name ] ) ){
                continue;
            }

            // Sanitize string properties
            if( $this->default_operator->get_property_type( $property_name ) === 'string' ){
                $preset_data[ $property_name ] = sanitize_text_field( $preset_data[ $property_name ] );
                continue;
            }
            
            // Convert int properties
            if( $this->default_operator->get_property_type( $property_name ) === 'int' ){
                $preset_data[ $property_name ] = intval( $preset_data[ $property_name ] );
                continue;
            }
            
            // Convert float properties
            if( $this->default_operator->get_property_type( $property_name ) === 'float' ){
                $preset_data[ $property_name ] = floatval( $preset_data[ $property_name ] );
                continue;
            }
            
            // Handle checkbox/bool properties
            if( $this->default_operator->get_property_type( $property_name ) === 'bool' ){
                $preset_data[$property_name] = $preset_data[$property_name] === '1' || $preset_data[$property_name] === 'true' || 
                                                    $preset_data[$property_name] === 'on' || $preset_data[$property_name] === 1 
                                                    ? '1' : '0';
                continue;
            }
            
            // Handle array properties
            if( $this->default_operator->get_property_type( $property_name ) === 'array' ){
                $array_data = Operator::maybe_json_decode( stripslashes($preset_data[$property_name]), true );
                if( is_array( $array_data ) ){
                    $preset_data[$property_name] = $array_data;
                } else {
                    $preset_data[$property_name] = [];
                }
            }
        }

        // Update settings, without overriding results
        $this->presets[$preset_id] = array_merge( $this->presets[$preset_id], $preset_data );
        update_option(Main::SLUG . '_presets', $this->presets);

        wp_send_json_success($preset_data);
    }

    /**
     * Handle loading a preset via AJAX
     */
    public function handle_load_preset() {
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        if (!check_ajax_referer('api_tester_nonce', 'nonce', false)) {
            wp_send_json_error('Invalid nonce');
        }

        $preset_id = isset($_POST['preset_id']) ? sanitize_text_field($_POST['preset_id']) : '';
        if (!$preset_id) {
            wp_send_json_error('Invalid preset ID');
        }

        if (!isset($this->presets[$preset_id])) {
            wp_send_json_error('Preset not found');
        }

        wp_send_json_success($this->presets[$preset_id]);
    }

    /**
     * Handle deleting a preset via AJAX
     */
    /**
     * Get tooltip text for a field
     * 
     * @param string $field_name The name of the field
     * @return string The tooltip text
     */
    private function get_field_tooltip($field_name) {
        $tooltips = [
            'endpoint' => 'A common endpoint of an API request. Required field that must be a valid HTTP/HTTPS URL.',
            'route' => 'A route of an API request. Optional field that gets appended to the end of the endpoint to create a full request URL.',
            'url' => 'The target URL for the API request. Required field that must be a valid HTTP/HTTPS URL.',
            'method' => "Request method. Accepts 'GET', 'POST', 'HEAD', 'PUT', 'DELETE', 'TRACE', 'OPTIONS', or 'PATCH'. Some transports technically allow others, but should not be assumed. Default 'GET'.",
            'httpversion' => "Version of the HTTP protocol to use. Accepts '1.0' and '1.1'. Default '1.0'.",
            'timeout' => 'How long the connection should stay open in seconds. Default 5.',
            'redirection' => 'Number of allowed redirects. Not supported by all transports. Default 5.',
            'headers' => "Array or string of headers to send with the request. Default empty array.",
            'body' => "Body to send with the request. Default null.",
            'body_format' => "Format the body before sending the request. Accepts 'json' or 'array'. Default 'json'.",
            'cookies' => "List of cookies to send with the request. Default empty array.",
            'stream' => "Whether to stream to a file. If set to true and no filename was given, it will be dropped it in the WP temp dir and its name will be set using the basename of the URL. Default false.",
            'filename' => "Filename of the file to write to when streaming. Stream must be set to true. Default null.",
            'limit_response_size' => 'Maximum size of the response. Use the slider to adjust. If unlimited is checked, no size limit will be applied.',
            'compress' => "Whether to compress the body when sending the request. Default false.",
            'decompress' => "Whether to decompress a compressed response. If set to false and compressed content is returned in the response anyway, it will need to be separately decompressed. Default true.",
            'sslverify' => "Whether to verify SSL for the request. Default true.",
            'sslcertificates' => "Absolute path to an SSL certificate .crt file. Default " . ABSPATH . WPINC . "/certificates/ca-bundle.crt",
            'user_agent' => "Custom User-Agent string. If left blank, WordPress default will be used. Default 'WordPress/' . get_bloginfo( 'version' ) . '; ' . get_bloginfo( 'url' ).",
            'blocking' => "Whether the calling code requires the result of the request. If set to false, the request will be sent to the remote server, and processing returned to the calling code immediately, the caller will know if the request succeeded or failed, but will not receive any response from the remote server. Default true.",
            'reject_unsafe_urls' => "Whether to pass URLs through wp_http_validate_url(). Default false.",
            'preserve_header_case' => 'Preserve the case of HTTP header names. If unchecked, headers will be normalized to lowercase.',
        ];

        return $tooltips[$field_name] ?? '';
    }

    /**
     * Handle deleting a preset via AJAX
     */
    public function handle_delete_preset() {
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        if (!check_ajax_referer('api_tester_nonce', 'nonce', false)) {
            wp_send_json_error('Invalid nonce');
        }

        $preset_id = $_POST['preset_id'] ?? null;
        if (!$preset_id) {
            wp_send_json_error('Invalid preset ID');
        }

        // Remove the preset if it exists
        if (isset($this->presets[$preset_id])) {
            unset($this->presets[$preset_id]);
            update_option(Main::SLUG . '_presets', $this->presets);
            wp_send_json_success();
        } else {
            wp_send_json_error('Preset not found');
        }
    }

    private function validate_title($preset_id, $title, $allow_duplicates = false) {
        $title = sanitize_text_field($title);

        // If this is a new preset, make sure the title doesn't already exist or increment the number
        if( $this->is_new_preset($preset_id) ){
            if( $this->title_exists($title) ){
                $title = $allow_duplicates ? $this->increment_title_number($title) : false;
            }
        }

        return $title;
    }

    private function increment_title_number($title) {
        $old_title = $title;
        
        // Check if the string ends in (Copy 1), (Copy 2), etc.
        if( preg_match('/\(Copy\s*(\d+)\)$/', $title, $matches) ) {
            // If so then increment the number
            $number = $matches[1];

            // get the length of "(Copy " to "{x})"
            $length = strlen(" (Copy ") + strlen($number) + strlen(")");
            $title = substr($title, 0, -$length);
            $title .= ' (Copy ' . ($number + 1) . ')';
        } else {
            $title .= ' (Copy 1)';
        }

        if( $this->title_exists($title) ){
            $title = $this->increment_title_number($title);
        }

        return $title;
    }

    private function is_new_preset($preset_id) {
        return !isset($this->presets[$preset_id]);
    }

    private function title_exists($title) {
        return in_array($title, array_map(function($preset) {
            return $preset['title'];
        }, $this->presets));
    }

    private function store_response( $preset_id, $response ){
        if( !isset($this->presets[$preset_id]['responses']) ){
            $this->presets[$preset_id]['responses'] = [];
        }

        // insert response at beginning of array
        array_unshift($this->presets[$preset_id]['responses'], $response);
        
        // remove any responses over the max
        $max_responses = 10;
        while( count($this->presets[$preset_id]['responses']) > $max_responses ){
            array_pop($this->presets[$preset_id]['responses']);
        }

        update_option(Main::SLUG . '_presets', $this->presets);
    }

}

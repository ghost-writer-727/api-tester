<?php namespace API_Tester;
defined( 'ABSPATH' ) || exit;

class Settings{ 
    private static $instance;
    private $default_operator;
    private $options_cache;

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
                    <?php echo $this->get_settings(); ?>
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
    public function get_settings($id = null) {
        // If no ID provided, use the default operator instance
        $operator = $id === null ? $this->default_operator : new Operator();
        
        // Get reflection of operator class to get public properties
        $reflection = new \ReflectionClass($operator);
        $properties = $reflection->getProperties(\ReflectionProperty::IS_PUBLIC);
        
        $html = '<form class="api-tester-form" data-preset-id="' . esc_attr($id) . '">';
        foreach ($properties as $property) {
            $name = $property->getName();
            $value = $property->getValue($operator);
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

        $allow_duplicates = isset($_POST['allow_incrementing_title']) && $_POST['allow_incrementing_title'] === '1';
        $title = $this->validate_title($_POST['title'], $allow_duplicates);
        if( !$title ) {
            wp_send_json_error(['message' => 'Title already exists']);
        }
        
        // Save the preset with title
        $preset_data = $_POST;
        $preset_data['title'] = $title;

        // Handle array fields (headers, cookies, body)
        $array_fields = ['headers', 'cookies', 'body'];
        foreach ($array_fields as $field) {
            if (isset($preset_data[$field])) {
                $array_data = json_decode(stripslashes($preset_data[$field]), true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $preset_data[$field] = $array_data;
                } else {
                    $preset_data[$field] = [];
                }
            }
        }

        // Ensure checkbox fields are properly saved as boolean values
        $checkbox_fields = ['stream', 'decompress', 'sslverify', 'blocking', 'reject_unsafe_urls', 'preserve_header_case'];
        foreach ($checkbox_fields as $field) {
            $preset_data[$field] = isset($preset_data[$field]) && 
                                       ($preset_data[$field] === '1' || $preset_data[$field] === 'true' || 
                                        $preset_data[$field] === 'on' || $preset_data[$field] === 1) ? '1' : '0';
        }

        $this->presets[$preset_id] = $preset_data;
        update_option(Main::SLUG . '_presets', $this->presets);

        wp_send_json_success([
            'preset_id' => $preset_id,
            'title' => $title
        ]);
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
            'url' => 'The target URL for the API request. Required field that must be a valid HTTP/HTTPS URL.',
            'method' => 'HTTP method for the request. If not selected, defaults to GET.',
            'httpversion' => 'HTTP protocol version to use. If not specified, defaults to HTTP/1.1.',
            'timeout' => 'Number of seconds to wait for the request to complete. If left blank, defaults to 5 seconds.',
            'redirection' => 'Number of redirects to follow. If left blank, defaults to 5 redirects.',
            'headers' => 'HTTP headers to send with the request. If left blank, default WordPress headers will be used.',
            'body' => 'Request body data. For POST/PUT requests, this will be sent as form data. If left blank, no body will be sent.',
            'cookies' => 'Cookies to send with the request. If left blank, no cookies will be sent.',
            'stream' => 'Whether to stream the response to a file rather than load it into memory. Useful for large responses.',
            'filename' => 'When stream is enabled, this is the filename where the response will be saved. If left blank, a temporary filename will be generated.',
            'limit_response_size' => 'Maximum size of the response in bytes. Use the slider to adjust. If unlimited is checked, no size limit will be applied.',
            'decompress' => 'Whether to decompress gzipped responses. If unchecked, compressed responses will remain compressed.',
            'sslverify' => 'Whether to verify SSL certificates. Disable only for testing with self-signed certificates.',
            'sslcertificates' => 'Path to a custom SSL certificate file. If left blank, WordPress default certificates will be used.',
            'user_agent' => 'Custom User-Agent string. If left blank, WordPress default will be used.',
            'blocking' => 'Whether to wait for the response. If unchecked, request will be sent asynchronously.',
            'reject_unsafe_urls' => 'Reject URLs that WordPress considers unsafe. Recommended to leave enabled for security.',
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

    private function validate_title($title, $allow_duplicates = false) {
        $title = sanitize_text_field($title);

        if( $this->title_exists($title) ){
            $title = $allow_duplicates ? $this->increment_title_number($title) : false;
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

    private function title_exists($title) {
        return in_array($title, array_map(function($preset) {
            return $preset['title'];
        }, $this->presets));
    }

}

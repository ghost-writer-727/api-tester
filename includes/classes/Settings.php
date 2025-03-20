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
        add_action('wp_ajax_save_api_preset', [$this, 'handle_save_preset']);
        add_action('wp_ajax_load_api_preset', [$this, 'handle_load_preset']);
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
        // $this->presets = [ ['title' => 'Test 1', 'desc' => 'This is my description.', 'id' => 'preset_1'], ['title' => 'Test 2', 'desc' => 'This is my description.', 'id' => 'preset_2'], ['title' => 'Test 3', 'desc' => 'This is my description.', 'id' => 'preset_3'], ['title' => 'Test 4', 'desc' => 'This is my description.', 'id' => 'preset_4'], ['title' => 'Test 5', 'desc' => 'This is my description.', 'id' => 'preset_5'], ['title' => 'Test 6', 'desc' => 'This is my description.', 'id' => 'preset_6'], ['title' => 'Test 7', 'desc' => 'This is my description.', 'id' => 'preset_7'], ['title' => 'Test 8', 'desc' => 'This is my description.', 'id' => 'preset_8'], ['title' => 'Test 9', 'desc' => 'This is my description.', 'id' => 'preset_9'], ['title' => 'Test 10', 'desc' => 'This is my description.', 'id' => 'preset_10']];
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <div class="api-tester">
                <div class="api-presets">
                    <h2>Presets</h2>
                    <input type="button" value="New +" class="button api-preset" data-preset-id=""/>
                    <?php foreach( $this->presets as $preset ){
                        echo '<input type="button" value="' . esc_attr($preset['title']) . '" class="button api-preset" data-preset-id="' . esc_attr($preset['id']) . '"/>';
                    } ?>
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
            'nonce' => wp_create_nonce('api_tester_nonce')
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
            
            $html .= '<p class="form-field ' . esc_attr($field_id) . '_field">';
            $html .= '<label for="' . esc_attr($field_id) . '">' . esc_html(ucfirst(str_replace('_', ' ', $name))) . '</label>';
            
            // Handle different types of values
            if (is_bool($value)) {
                $html .= '<input type="checkbox" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" value="1"' . 
                        checked($value, true, false) . '>';
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
            } else {
                $html .= '<input type="text" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" value="' . 
                        esc_attr($value) . '">';
            }
            
            $html .= '</p>';
        }
        $html .= '<p class="api-tester-buttons"><input type="button" value="Run Test" class="button button-primary api-tester-run"><input type="button" value="Save Preset" class="button button-secondary api-tester-save"></p>';
        $html .= '</form>';
        
        return $html;
    }

    /**
     * Handle saving a preset via AJAX
     */
    public function handle_save_preset() {
        if (!current_user_can('manage_options')) {
            wp_send_json_error('Insufficient permissions');
        }

        if (!check_ajax_referer('api_tester_nonce', 'nonce', false)) {
            wp_send_json_error('Invalid nonce');
        }

        $preset = $_POST['preset'] ?? null;
        if (!$preset || !isset($preset['id'])) {
            wp_send_json_error('Invalid preset data');
        }

        // Get existing presets
        $presets = get_option(Main::SLUG . '_presets', []);
        $presets[$preset['id']] = $preset;

        // Save all presets
        update_option(Main::SLUG . '_presets', $presets);

        wp_send_json_success();
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

        $presets = get_option(Main::SLUG . '_presets', []);
        if (!isset($presets[$preset_id])) {
            wp_send_json_error('Preset not found');
        }

        wp_send_json_success($presets[$preset_id]);
    }
}

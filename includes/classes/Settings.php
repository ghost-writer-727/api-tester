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
        foreach( get_option( Main::SLUG . '_preset_keys', [] ) as $key ){
            if( $preset = get_option( Main::SLUG . '_preset_' . $key, [] ) ){
                $this->presets[$key] = $preset;
            }
        }
        
        add_action('admin_menu', [$this, 'register_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'admin_enqueue_scripts']);
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
        <div class="wrap api-tester">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form class="api-tester-form">
                <?php echo $this->get_settings(); ?>
            </form>
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
        
        $html = '';
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
                $html .= '<textarea id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" rows="5" cols="50">' . 
                        esc_textarea(json_encode($value, JSON_PRETTY_PRINT)) . '</textarea>';
            } else {
                $html .= '<input type="text" id="' . esc_attr($field_id) . '" name="' . esc_attr($name) . '" value="' . 
                        esc_attr($value) . '">';
            }
            
            $html .= '</p>';
        }
        
        return $html;
    }
}

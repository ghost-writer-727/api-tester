<?php namespace API_Tester;
defined( 'ABSPATH' ) || exit;
/**
 * Plugin Name: API Tester
 * Description: A plugin to test APIs calls.
 * Version: 0.0.1
 * Author: Ghostwriter
 */

require 'includes/classes/Operator.php';
require 'includes/classes/Settings.php';

class Main{
    private static $instance;

    public static function get_instance(){
        if( ! self::$instance ){
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct(){
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), [$this, 'add_action_links']);
        Settings::get_instance();
    }

    /**
     * Add settings link to plugin actions
     */
    public function add_action_links($links) {
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            admin_url('admin.php?page=' . Settings::SLUG),
            __('Settings', 'api-tester')
        );
        array_unshift($links, $settings_link);
        return $links;
    }
}

// Initialize plugin
Main::get_instance();
<?php namespace API_Tester;
defined( 'ABSPATH' ) || exit;
/**
 * Plugin Name: API Tester
 * Description: A plugin to test APIs calls.
 * Version: 0.1.2
 * Author: Ghostwriter
 */

require 'includes/classes/Operator.php';
require 'includes/classes/Settings.php';

class Main{
    const SLUG = 'api_tester';
    const NAME = 'API Tester';
    const DIR = __DIR__;
    const FILE = __FILE__;

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

    public static function get_dir_url(){
        return plugins_url( '', self::FILE );
    }

    /**
     * Add settings link to plugin actions
     */
    public function add_action_links($links) {
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            admin_url('admin.php?page=' . Main::SLUG),
            __('Settings', 'api-tester')
        );
        array_unshift($links, $settings_link);
        return $links;
    }
}

add_filter( 'api_tester_custom_encoders', function( $encoders ){
    $encoders['4over'] = '4Over';
    return $encoders;
}, 10, 1);

add_filter( 'api_tester_encode_4over', function( $encodable, $operator ){
    return hash_hmac("sha256", $operator->method, hash("sha256", $encodable));
}, 10, 2);

// Initialize plugin
Main::get_instance();
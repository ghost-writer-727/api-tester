<?php namespace API_Tester;
defined( 'ABSPATH' ) || exit;

class Settings{
    const SLUG = 'api_tester';
    
    private static $instance;

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
        foreach( get_option( self::SLUG . '_preset_keys', [] ) as $key ){
            if( $preset = get_option( self::SLUG . '_preset_' . $key, [] ) ){
                $this->presets[$key] = $preset;
            }
        }
    }

}


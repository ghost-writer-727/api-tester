<?php namespace API_Tester;
defined( 'ABSPATH' ) || exit;

class Operator{
    public $title = '';
    public $description = '';
    public $endpoint = '';
    public $route = '';
    public $method = 'GET';
    public $timeout = 5.0;
    public $redirection = 5;
    public $httpversion = '1.0';
    public $user_agent = ''; // Defaults to get_bloginfo( 'url' ) on construction
    public $reject_unsafe_urls = false;
    public $blocking = true;
    public $headers = [
        'Accept' => 'application/json',
        'Content-Type' => 'application/json',
        'Authorization' => ''
    ];
    public $cookies = [];
    public $body = [];
    public $body_format = 'json'; // 'json','array'
    public $compress = false;
    public $decompress = true;
    public $sslverify = true;
    public $sslcertificates; // Absolute path to an SSL certificate file. Defaults to Wordpress defaults when empty.
    public $stream = false;
    public $filename; // Filename of the file to save the streaed response.
    public $limit_response_size; // Size in bytes to limit the response to.

    private $public_propertiy_types = [];
    private $response;
    private $error;

    public function __construct( $args = [] ){
        $this->user_agent = 'WordPress/' . get_bloginfo( 'version' ) . '; ' . get_bloginfo( 'url' );

        // Set this at constructor so that any time it's checked, the code knows what type to expect.
        // Especially important if the property expects a specific type but needs to be changed to null in the event it's empty.
        foreach( $this->get_args() as $key => $value ){
            $this->public_propertiy_types[$key] = gettype($value);
        }
        $this->set_args( $args );
    }

    public function get_public_property_names(){
        return [
            'title',
            'description',
            'endpoint',
            'route',
            'method',
            'timeout',
            'redirection',
            'httpversion',
            'user_agent',
            'reject_unsafe_urls',
            'blocking',
            'headers',
            'cookies',
            'body',
            'body_format',
            'compress',
            'decompress',
            'sslverify',
            'sslcertificates',
            'stream',
            'filename',
            'limit_response_size',
        ];
    }

    public function get_property_type( $property_name ){
        return $this->public_propertiy_types[$property_name] ?? null;
    }

    public function set_args( $args = [] ){
        foreach( $args as $key => $value ){
            error_log( "$key: " . $this->get_property_type( $key ) );

            if( in_array( $key, $this->get_public_property_names() ) ){
                if( $key == 'method' ){
                    $this->$key = strtoupper( $value );
                }else{
                    $this->$key = $value;
                }
                // Match with the expected property types
                switch( $this->get_property_type( $key ) ){
                    case 'boolean':
                        $this->$key = filter_var( $value, FILTER_VALIDATE_BOOLEAN );
                        break;
                    case 'integer':
                        if( is_numeric( $value ) ){
                            $this->$key = filter_var( $value, FILTER_VALIDATE_INT );
                        }
                        break;
                    case 'double':
                        if( is_numeric( $value ) ){
                            $this->$key = filter_var( $value, FILTER_VALIDATE_FLOAT );
                        }
                        break;
                    case 'string':
                        if( is_string( $value ) ){
                            $this->$key = sanitize_text_field( $value );
                        }
                        break;
                    case 'array':
                        $value = self::maybe_json_decode( $value );
                        if( is_array( $value ) ){
                            $this->$key = array_map( 'sanitize_text_field', $value );
                        }
                        break;
                }

                // Exceptions/Overrides
                switch( $key ){
                    case 'body':
                        if( empty( $value ) ){
                            $this->$key = null;
                        }
                        if( $this->body_format == 'json' ){
                            $this->$key = json_encode( $value );
                        }
                        // Otherwise it's already been set as an array
                        break;
                    case 'stream':
                        $this->filename = null;
                        break;
                    case 'limit_response_size':
                        if( ! is_numeric( $value ) ){
                            $this->$key = null;
                        }
                        break;
                }
            }
        }
    }

    public function get_args(){
        $args = [];
        foreach( $this->get_public_property_names() as $arg ){
            if( isset( $this->$arg ) ){
                $args[$arg] = $this->$arg;
            }
        }
        return $args;
    }

    public function get() {
        $this->method = 'GET';
        return $this->request();
    }

    public function post() {
        $this->method = 'POST';
        return $this->request();
    }

    public function request() {
        $url = $this->endpoint . $this->route;
        $args = $this->get_args();
        
        // Remove certain args as they aren't supported by wp_remote_request $args
        if( isset( $args['title'] ) ) unset( $args['title'] );
        if( isset( $args['description'] ) ) unset( $args['description'] );
        if( isset( $args['endpoint'] ) ) unset( $args['endpoint'] );
        if( isset( $args['route'] ) ) unset( $args['route'] );
        if( isset( $args['body_format'] ) ) unset( $args['body_format'] );
        
        $args['method'] = $this->method; // Ensure method is uppercase
        $this->response = wp_remote_request($url, $args);

        return $this->process_response();
    }

    private function process_response() {
        if (is_wp_error($this->response)) {
            $this->error = $this->response->get_error_message();
            return [
                'error' => $this->error,
                'response' => null,
                'status_code' => null,
                'args' => $this->get_args()
            ];
        }

        return [
            'error' => null,
            'response' => self::maybe_json_decode( wp_remote_retrieve_body($this->response) ),
            'status_code' => wp_remote_retrieve_response_code($this->response),
            'args' => $this->get_args()
        ];
    }

    public static function maybe_json_decode( $var, $assoc = true ){
        if( is_string( $var ) && strpos( $var, '{' ) !== false && strpos( $var, '}' ) !== false && $array = json_decode( stripslashes($var), $assoc ) ){
            if( $array !== null ){
                return $array;
            }
        }
        return $var == '{}' ? [] : $var;
    }

    public function get_response() {
        return $this->response;
    }

    public function get_error() {
        return $this->error;
    }
}
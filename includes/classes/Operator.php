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
    public $user_agent = ''; // Default set in constructor
    public $reject_unsafe_urls = false;
    public $blocking = true;
    public $content_type = 'application/json';
    public $accept = 'application/json';
    public $authorization = '';
    public $encoding_type = '';
    public $x_auth_token = '';
    public $x_auth_type = '';
    public $cache_control = '';
    public $headers = [];
    public $cookies = [];
    public $body = [];
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

    public static function get_public_property_names(){
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
            'authorization',
            'encoding_type',
            'content_type',
            'cache_control',
            'accept',
            'headers',
            'cookies',
            'body',
            'compress',
            'decompress',
            'sslverify',
            'sslcertificates',
            'stream',
            'filename',
            'limit_response_size',
        ];
    }

    public static function get_encoders(){
        return apply_filters( 'api_tester_custom_encoders', [
            'base64' => 'Base64',
            'md5' => 'MD5',
        ] );
    }

    public function get_property_type( $property_name ){
        return $this->public_propertiy_types[$property_name] ?? null;
    }

    public function set_args( $args = [] ){
        foreach( $args as $key => $value ){

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
                    case 'stream':
                        if( empty( $value ) ){
                            $this->filename = null;
                        }
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

    public function get_args( $prep_for_request = false ){
        $args = [];
        foreach( $this->get_public_property_names() as $arg ){
            if( isset( $this->$arg ) ){
                $args[$arg] = $this->$arg;
            }
        }

        if( $prep_for_request ){
            // Remove certain args as they aren't supported by wp_remote_request $args
            if( isset( $args['title'] ) ) unset( $args['title'] );
            if( isset( $args['description'] ) ) unset( $args['description'] );
            if( isset( $args['endpoint'] ) ) unset( $args['endpoint'] );
            if( isset( $args['route'] ) ) unset( $args['route'] );
            
            $args['headers'] = $this->prepare_headers() ?: [];
            if( isset( $args['authorization'] ) ) unset( $args['authorization'] );
            if( isset( $args['encoding_type'] ) ) unset( $args['encoding_type'] );
            if( isset( $args['content_type'] ) ) unset( $args['content_type'] );
            if( isset( $args['cache_control'] ) ) unset( $args['cache_control'] );
            if( isset( $args['accept'] ) ) unset( $args['accept'] );
            if( isset( $args['body'] )  && $args['body'] ) $args['body'] = $this->prepare_body();
            
            $args['method'] = $this->method; // Ensure method is uppercase
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

    public function put() {
        $this->method = 'PUT';
        return $this->request();
    }

    public function delete() {
        $this->method = 'DELETE';
        return $this->request();
    }

    public function patch() {
        $this->method = 'PATCH';
        return $this->request();
    }

    public function request() {
        $url = $this->endpoint . $this->route;
        $args = $this->get_args(true);
        
        $this->response = wp_remote_request($url, $args);

        return $this->process_response();
    }

    private function process_response() {
        if (is_wp_error($this->response)) {
            $this->error = $this->response->get_error_message();
            return [
                'error' => $this->error,
                'body' => null,
                'status_code' => null,
                'args' => $this->get_args(),
                'timestamp' => time()
            ];
        }

        return [
            'error' => null,
            'body' => self::maybe_json_decode( wp_remote_retrieve_body($this->response) ),
            'status_code' => wp_remote_retrieve_response_code($this->response),
            'args' => $this->get_args(),
            'timestamp' => time(),
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

    private function prepare_headers(){
        $headers = $this->headers;
        if( is_array( $headers ) ){

            if( $this->body && $this->content_type){
                $headers['Content-Type'] = $this->content_type;
            } else {
                unset( $headers['Content-Type'] );
            }
            
            if( $this->authorization && $authorization = $this->prepare_authorization() ){
                $headers['Authorization'] = $authorization;
            } else {
                unset( $headers['Authorization'] );
            }

            if( $this->cache_control ){
                $headers['Cache-Control'] = $this->cache_control;
            } else {
                unset( $headers['Cache-Control'] );
            }

            if( $this->accept ){
                $headers['Accept'] = $this->accept;
            } else {
                unset( $headers['Accept'] );
            }

            $headers = array_map( 'sanitize_text_field', $headers );
        }
        return $headers;
    }

    private function prepare_authorization(){
        if( $this->authorization && ( ! $this->encoding_type || array_key_exists( $this->encoding_type, $this->get_encoders()) ) ){
            $authorization = $this->authorization;
            $encodables = $this->get_encodables();
            foreach( $encodables as $encodable ){
                $variable = str_replace( '{', '', str_replace( '}', '', $encodable ) );
                switch( $this->encoding_type ){
                    case 'base64':
                        $authorization = str_replace( $encodable, base64_encode( $variable ), $authorization );
                        break;
                    case 'md5':
                        $authorization = str_replace( $encodable, md5( $variable ), $authorization );
                        break;
                    default:
                        $custom_encoding = apply_filters( 'api_tester_encode_' . $this->encoding_type, $variable, $this );
                        $authorization = str_replace( $encodable, $custom_encoding, $authorization );
                        break;
                }
            }
            return $authorization;
        }
        return null;
    }

    private function get_encodables(){
        // return an array of all strings within curly braces.
        preg_match_all('/\{[^}]+\}/', $this->authorization, $matches);
        return $matches[0];
    }

    private function prepare_body(){
        $body = null;
        if( $this->body ){
            switch( $this->content_type ){
                case 'application/json':
                    $body = json_encode( $this->body );
                    break;
                case 'application/x-www-form-urlencoded': // wp_remote_request() will url-encode this for us
                    $body = $this->body;
                    break;
                case 'text/plain':
                default:
                    if( is_string( $this->body ) ){
                        $body = sanitize_text_field( $this->body );
                    }
                    break;
            }
        }
        return $body;
    }
}
<?php namespace API_Tester;
defined( 'ABSPATH' ) || exit;

class Operator{
    public $title;
    public $description;
    public $endpoint;
    public $method = 'GET';
    public $route;
    public $timeout = 5;
    public $redirection = 5;
    public $httpversion = '1.1';
    public $user_agent; // Defaults to get_bloginfo( 'url' ) on construction
    public $reject_unsafe_urls = false;
    public $blocking = true;
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

    private $response;
    private $error;

    public function __construct( $args = [] ){
        $this->user_agent = get_bloginfo( 'url' );
        $this->set_args( $args );
    }

    public function set_args( $args = [] ){
        foreach( $args as $key => $value ){
            if( property_exists( $this, $key ) ){
                if( $key == 'method' ){
                    $this->$key = strtoupper( $value );
                }else{
                    $this->$key = $value;
                }
            }
        }
    }

    public function get_args(){
        $args = [];
        foreach( [ 
            'timeout', 
            'redirection', 
            'httpversion', 
            'user_agent', 
            'reject_unsafe_urls', 
            'blocking', 
            'headers', 
            'cookies', 
            'body', 
            'compress', 
            'decompress', 
            'sslverify', 
            'sslcertificates', 
            'stream', 
            'filename', 
            'limit_response_size' 
        ] as $arg ){
            if( isset( $this->$arg ) ){
                $args[$arg] = $this->$arg;
            }
        }
        return $args;
    }

    public function get() {
        return $this->request('GET');
    }

    public function post() {
        return $this->request('POST');
    }

    public function request($method) {
        $url = $this->endpoint . $this->route;
        $args = $this->get_args();
        
        // Remove title and description from args as they aren't supported by wp_remote_request
        if( isset( $args['title'] ) ) unset( $args['title'] );
        if( isset( $args['description'] ) ) unset( $args['description'] );
        
        $args['method'] = strtoupper($method); // Ensure method is uppercase

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
            'response' => wp_remote_retrieve_body($this->response), // Extract response body
            'status_code' => wp_remote_retrieve_response_code($this->response),
            'args' => $this->get_args()
        ];
    }

    public function get_response() {
        return $this->response;
    }

    public function get_error() {
        return $this->error;
    }
}
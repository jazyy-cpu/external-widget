// PlatformServices.js
// Platform Services module for 3DEXPERIENCE Platform integration
// Provides authentication, URL computation, and security context management

define('DS/PlatformServices/PlatformServices', [
    'UWA/Class',
    'DS/i3DXCompassPlatformServices/i3DXCompassPlatformServices',
    'DS/WAFData/WAFData'
], function (Class, i3DXCompassPlatformServices, WAFData) {
    'use strict';

    // Platform Services Singleton (following the exact pattern from ChangeOnEngineeringWidget)
    var PlatformServices = Class.singleton({
        
        /**
         * Get global variable object containing platform configuration
         */
        getGlobalVariable: function () {
            return this.GlobalVariable || this.setGlobalVariable(), this.GlobalVariable;
        },
        
        /**
         * Initialize global variable with platform configuration structure
         */
        setGlobalVariable: function () {
            this.GlobalVariable = {
                userId: "",
                SecurityContext: "",
                serviceName: "/3dspace",
                baseURL: "",
                tenant: "",
                mySecurityContext: "",
                
                /**
                 * Get 3DSpace base URL
                 */
                get3DSpaceURL: function () {
                    return this.baseURL;
                },
                
                /**
                 * Get Swym URL for social collaboration
                 */
                getSwymURL: function () {
                    return this.swymURL;
                },
                
                /**
                 * Get Compass URL for navigation
                 */
                getCompassURL: function () {
                    return this.compassURL;
                },
                
                /**
                 * Compute full URL by appending endpoint to base URL
                 * @param {string} endpoint - API endpoint to append
                 * @returns {string} Complete URL
                 */
                computeUrl: function (endpoint) {
                    return this.get3DSpaceURL() + endpoint;
                },
                
                /**
                 * Get current security context
                 */
                getSecurityContext: function () {
                    return this.SecurityContext;
                },
                
                /**
                 * Get current user ID
                 */
                getCurrentUser: function () {
                    return this.userId;
                }
            };
        },
        
        /**
         * Populate 3DSpace URL from platform services
         * @returns {Promise} Promise that resolves when URL is populated
         */
        populate3DSpaceURL: function () {
            var current = this;
            var global = current.getGlobalVariable();
            
            return new Promise(function (resolve, reject) {
                console.log('[PlatformServices] Getting platform services...');
                
                i3DXCompassPlatformServices.getPlatformServices({
                    platformId: "OnPremise",
                    onComplete: function (response) {
                        console.log('[PlatformServices] Platform services response:', response);
                        
                        // Handle both array and object responses
                        var platformData = response.hasOwnProperty("length") ? response[0] : response;
                        
                        global.baseURL = platformData["3DSpace"];
                        global.tenant = platformData["platformId"];
                        global.swymURL = platformData["3DSwym"];
                        global.compassURL = platformData["3DCompass"];
                        
                        console.log('[PlatformServices] Platform URLs populated:', {
                            baseURL: global.baseURL,
                            tenant: global.tenant,
                            swymURL: global.swymURL,
                            compassURL: global.compassURL
                        });
                        
                        resolve(response);
                    },
                    onFailure: function(error) {
                        console.error('[PlatformServices] Failed to get platform services:', error);
                        reject(error);
                    }
                });
            });
        },
        
        /**
         * Populate security context from platform
         * @returns {Promise} Promise that resolves when security context is populated
         */
        populateSecurityContext: function () {
            var current = this;
            var global = current.getGlobalVariable();
            
            // Construct security context URL
            var url = global.computeUrl("/resources/pno/person/getsecuritycontext");
            var timestamp = new Date().getTime();
            url = url + "?tenant=" + global.tenant +
                "&current=true&select=preferredcredentials&select=collabspaces" + "&timestamp=" + timestamp;
            
            console.log('[PlatformServices] Getting security context from:', url);
            
            return new Promise(function (resolve, reject) {
                WAFData.authenticatedRequest(url, {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                    },
                    timeout: 864e5, // Large timeout for security context
                    type: "json",
                    onComplete: function (response) {
                        console.log('[PlatformServices] Security context response:', response);
                        
                        global.SecurityContext = response.SecurityContext;
                        global.mySecurityContext = response.SecurityContext;
                        
                        console.log('[PlatformServices] Security context populated:', global.SecurityContext);
                        resolve(response);
                    },
                    onFailure: function (error, details) {
                        console.error('[PlatformServices] Failed to get security context:', error, details);
                        var errorMessage = error.message || 'Unknown error';
                        reject(errorMessage);
                    },
                    onTimeout: function () {
                        console.error('[PlatformServices] Security context request timed out');
                        reject("timeout");
                    }
                });
            });
        },
        
        /**
         * Populate current user information
         * @returns {Promise} Promise that resolves when user info is populated
         */
        populateCurrentUser: function () {
            var current = this;
            var global = current.getGlobalVariable();
            
            return new Promise(function (resolve, reject) {
                console.log('[PlatformServices] Getting current user...');
                
                i3DXCompassPlatformServices.getUser({
                    onComplete: function (userResponse) {
                        console.log('[PlatformServices] User response:', userResponse);
                        
                        global.userId = userResponse.id;
                        
                        console.log('[PlatformServices] Current user populated:', global.userId);
                        resolve(userResponse);
                    },
                    onFailure: function(error) {
                        console.error('[PlatformServices] Failed to get current user:', error);
                        reject(error);
                    }
                });
            });
        },
        
        /**
         * Get CSRF token from platform
         * @returns {Promise} Promise that resolves when CSRF token is obtained
         */
        getCSRFToken: function () {
            var current = this;
            var global = current.getGlobalVariable();
            
            return new Promise(function (resolve, reject) {
                console.log('[PlatformServices] Getting CSRF token...');
                
                var url = global.computeUrl("/resources/v1/application/CSRF/");
                
                WAFData.authenticatedRequest(url, {
                    method: "GET",
                    headers: {
                        "Accept": "application/json",
                    },
                    timeout: 30000,
                    type: "json",
                    onComplete: function (response) {
                        console.log('[PlatformServices] CSRF token response:', response);
                        
                        if (response && response.csrf && response.csrf.value) {
                            global.CSRFToken = response.csrf.value;
                            console.log('[PlatformServices] CSRF token obtained successfully');
                            resolve(response.csrf.value);
                        } else {
                            console.error('[PlatformServices] Invalid CSRF response:', response);
                            reject("Invalid CSRF token response");
                        }
                    },
                    onFailure: function (error) {
                        console.error('[PlatformServices] Failed to get CSRF token:', error);
                        reject(error);
                    },
                    onTimeout: function () {
                        console.error('[PlatformServices] CSRF token request timeout');
                        reject("timeout");
                    }
                });
            });
        },
        
        /**
         * Initialize all platform services in sequence
         * @returns {Promise} Promise that resolves when all services are initialized
         */
        initializeAll: function() {
            var current = this;
            console.log('[PlatformServices] Starting full initialization...');
            
            // Initialize global variable first
            current.setGlobalVariable();
            
            // Chain the initialization calls
            return current.populate3DSpaceURL()
                .then(function (urlResult) {
                    console.log('[PlatformServices] 3DSpace URL populated successfully');
                    return current.populateSecurityContext();
                })
                .then(function (securityResult) {
                    console.log('[PlatformServices] Security context populated successfully');
                    return current.populateCurrentUser();
                })
                .then(function (userResult) {
                    console.log('[PlatformServices] Current user populated successfully');
                    return current.getCSRFToken();
                })
                .then(function (csrfToken) {
                    console.log('[PlatformServices] CSRF token obtained successfully');
                    console.log('[PlatformServices] Full initialization completed');
                    return current.getGlobalVariable();
                })
                .catch(function(error) {
                    console.error('[PlatformServices] Initialization failed:', error);
                    throw error;
                });
        },
        
        /**
         * Get platform information summary
         * @returns {Object} Summary of current platform configuration
         */
        getPlatformInfo: function() {
            var global = this.getGlobalVariable();
            return {
                baseURL: global.baseURL,
                tenant: global.tenant,
                userId: global.userId,
                hasSecurityContext: !!global.SecurityContext,
                serviceName: global.serviceName
            };
        },
        
        /**
         * Check if platform services are properly initialized
         * @returns {boolean} True if all required services are initialized
         */
        isInitialized: function() {
            var global = this.getGlobalVariable();
            return !!(global.baseURL && global.SecurityContext && global.userId && global.CSRFToken);
        }
    });

    return PlatformServices;
});

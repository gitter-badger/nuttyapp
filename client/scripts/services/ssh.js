/*
 * https://nutty.io
 * Copyright (c) 2014 krishna.srinivas@gmail.com All rights reserved.
 * GPLv3 License <http://www.gnu.org/licenses/gpl.txt>
 */

gRsaKeyWorkerJs = 'views/sign_ssh_data_worker.js';
paramikojs_log = false;


angular.module('nuttyapp')
    .factory('sshstate', ['$rootScope', function($rootScope) {
        var retobj = {
            error: "",
            state:""
        }
        window.auth_failure = function() {
            retobj.error = "Authentication failure";
            retobj.state = "authfailure";
            $rootScope.$apply();
        }
        window.sshstate = retobj;
        return retobj;
    }]);

angular.module('nuttyapp')
    .factory('ssh', ['$rootScope', 'sshstate', function($rootScope, sshstate) {
            var port;
            var inputcbk;
            var extid = "jeiifmbcmlhfgncnihbiicdbhnbagmnk";
            // var extid = "doafdnipfndehkkojdhpocnoifknlend";
            var trans;
            var channel;

            var retobj = {
                appinstalled: false,
                connect: function(sshserver, sshport, username, password, pvtkey, cbk) {
                    port = chrome.runtime.connect(extid);
                    sshstate.error = "";
                    sshstate.state = "connecting";
                    port.onMessage.addListener(function(msg) {
                        if (!msg) {
                            log.console("msg from BG app is undefined");
                            return;
                        }
                        if (msg.error) {
                            sshstate.state = "disconnected";
                            switch (-msg.error) {
                                case 102:
                                    sshstate.error = "connection refused";
                                    break;
                                case 105:
                                    sshstate.error = "DNS name resolution failed"
                                    break;
                                default:
                                    sshstate.error = "connection failure";
                            }
                            $rootScope.$apply()
                            console.log("error from socket : " + msg.error);
                        }
                        if (msg.connected) {
                            trans = new paramikojs.transport(null);
                            trans.writeCallback = function (str) {
                                port.postMessage({
                                    data: str
                                });
                            };
                            function auth_success() {
                                console.log("auth_success");
                                sshstate.state = "authsuccess";
                                sshstate.error = "";
                                $rootScope.$apply();
                                var on_success = function(chan) {
                                    chan.get_pty('xterm-256color', 96, 28);
                                    chan.invoke_shell();
                                    channel = chan;
                                    cbk();
                                };
                                trans.open_session(on_success);
                            }
                            window.input = function() {
                                try {
                                    var stdin = channel.recv(65536);
                                } catch (ex) {}
                                try {
                                    var stderr = channel.recv_stderr(65536);
                                } catch (ex) {}
                                if (stdin && inputcbk) {
                                    inputcbk({
                                        data: stdin
                                    });
                                }
                                if (stderr && inputcbk) {
                                    inputcbk({
                                        data: stderr
                                    });
                                }
                            }
                            port.postMessage({
                                tcpconnect: true,
                                server: sshserver,
                                port: sshport
                            });
                        }
                        if (msg.tcpconnected) {
                            sshstate.state = "authenticating";
                            $rootScope.$apply();
                            trans.connect (null, null, username, password, pvtkey, auth_success);
                        }
                        if (msg.data) {
                            if (!trans) {
                                console.log("trans is null");
                                return;
                            }
                            trans.fullBuffer += msg.data;  // read data
                            trans.run();
                        }
                    });
                    port.onDisconnect.addListener (function() {
                        port = undefined;
                        sshstate.state = "disconnected";
                        $rootScope.$apply();
                        console.log ("nutty BG app disconnected");
                    });
                },
                ondata: function(cbk) {
                    inputcbk = cbk;
                },
                write: function(msg) {
                    if (!channel) {
                        window.location.pathname = '/';
                        return;
                    }
                    if (!msg) {
                        console.log("ssh.write(): msg is null")
                        return;
                    }
                    if (msg.data) {
                        channel.send(msg.data);
                    } else if (msg.rowcol) {
                        channel.resize_pty(msg.col, msg.row);
                    } else {
                        port.postMessage(msg);
                    }
                }
            }

            if (window.chrome && window.chrome.runtime && window.chrome.runtime.connect) {
                var _port = chrome.runtime.connect(extid);
                _port.onMessage.addListener(function(msg) {
                    if (msg.connected) {
                        retobj.appinstalled = true;
                        _port.disconnect();
                    }
                });
            }
            window.ssh = retobj;
            return retobj;
        }]);

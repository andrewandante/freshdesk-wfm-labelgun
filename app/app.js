(function() {
    "use strict";
    return {
        events: [
            { event: 'click', selector: '.labelGun', callback: 'createTask' },
            { event: 'click', selector: '.creator-client', callback: 'createClient' },
            { event: 'click', selector: '.detective-client', callback: 'detectClient' },
            { event: 'click', selector: '.confirmer-client', callback: 'confirmClient' },
            { event: 'click', selector: '.eraser-client', callback: 'resetClient' }
        ],
        createTask: function() {
            var ticket = domHelper.ticket.getTicketInfo().helpdesk_ticket;
            if (ticket.custom_field !== undefined && ticket.custom_field.wfm_task_id !== undefined) {
                alert("Job already created!");
            } else {
                var url = "https://api.workflowmax.com/job.api/get/" + ticket.custom_field.wfm_job_id + "?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            }
            this.$request.get(url)
                .done(function(data) {
                console.log(data);
                    })
                .fail(function(err) {
                  console.log(err);
                });
            alert("You clicked!! " + ticket.display_id);
        },
        createClient: function() {
            var doc = this;
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title;
            var contact = domHelper.contact.getContactInfo().user;
            console.log(contact);

            if (confirm("This will create a new Client in WorkFlow Max called '"
                    + hackCompanyName
                    + "' with "
                    + contact.name
                    + " as the primary contact. Continue?")) {
                var wfmURL = "https://api.workflowmax.com/client.api/add?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
                var clientXML = "<Client>"
                    + "<Name>" + hackCompanyName + "</Name>"
                    + "<Contacts>"
                    + "<Contact>"
                    + "<Name>" + contact.name + "</Name>"
                    + "<Email>" + contact.email + "</Email>"
                    + "</Contact>"
                    + "</Contacts>"
                    + "</Client>";
                this.$request.post(wfmURL, {body: clientXML})
                    .done(function(data) {
                        var response = new window.DOMParser().parseFromString(data.response, "text/html");
                        var wfmClientID = response.getElementsByTagName("ID")[0].innerHTML;
                        var wfmClientName = response.getElementsByTagName("Name")[0].innerHTML;
                        doc.updateClientFrontEnd(wfmClientID, wfmClientName);
                        doc.confirmClient();
                    })
                    .fail(function(err) {
                        alert(err);
                });
            }
        },
        detectClient: function() {
            var doc = this;
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title;
            var wfmURL = "https://api.workflowmax.com/client.api/search?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>&query=" + hackCompanyName;
            this.$request.get(wfmURL)
                .done(function(data){
                    var response = new window.DOMParser().parseFromString(data.response, "text/html");
                    var wfmClientID = response.getElementsByTagName("ID")[0].innerHTML;
                    var wfmClientName = response.getElementsByTagName("Name")[0].innerHTML;
                    doc.updateClientFrontEnd(wfmClientID, wfmClientName);
                })
                .fail(function(err){
                    alert(err);
                });
        },
        confirmClient: function() {
            var doc = this;
            var wfmLink = this.$container.getElementsByClassName("wfm-client-link")[0];
            var companyID = domHelper.contact.getContactInfo().customer_id;
            var detectedClientName = wfmLink.dataset.wfmName;
            var detectedClientID = wfmLink.dataset.wfmId;

            this.$db.set( "client:" + companyID,
                { "wfmClientID": detectedClientID, "wfmClientName": detectedClientName })
                .done(function(data) {
                    doc.updateClientFrontEnd(detectedClientID, detectedClientName);
                    doc.hideButton("confirmer-client");
                    doc.hideButton("detective-client");
                    doc.hideButton("creator-client");
                    doc.showButton("eraser-client");
                    doc.$container.getElementsByClassName("header-client")[0].innerHTML = doc.$container.getElementsByClassName("header-client")[0].innerHTML.replace("detected", "saved");
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        resetClient: function() {
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title;
            var wfmLink = this.$container.getElementsByClassName("wfm-client-link")[0];
            var companyID = domHelper.contact.getContactInfo().customer_id;
            var detectedClientName = wfmLink.dataset.wfmName;

            if (confirm("Are you sure you want to erase the connection between the company '"
                    + hackCompanyName
                    + "' and the WorkFlow Max Client '"
                    + detectedClientName
                    + "'?")) {
                this.$db.delete ( "client:" + companyID)
                    .done(function(data) {
                        location.reload();
                    })
                    .fail(function(err) {
                        alert(err);
                    });
            }
        },
        hideButton: function(buttonClass) {
            this.$container.getElementsByClassName(buttonClass)[0].style.display = 'none';
        },
        showButton: function(buttonClass) {
            this.$container.getElementsByClassName(buttonClass)[0].style.display = '';
        },
        hideWrongButtons: function() {
            if (page_type == "ticket") {
                this.hideButton("holder-client");
            } else if (page_type == "contact") {
                this.hideButton("labelGun");
            }
        },
        checkForConnectedClient: function() {
            var doc = this;
            var clientID = domHelper.contact.getContactInfo().customer_id;
            this.$db.get("client:" + clientID)
                .done(function(data) {
                    doc.updateClientFrontEnd(data.wfmClientID, data.wfmClientName);
                    doc.hideButton("creator-client");
                    doc.hideButton("detective-client");
                    doc.hideButton("confirmer-client");
                })
                .fail(function(error_data) {
                    doc.$container.getElementsByClassName("header-client")[0].innerHTML = "No client connected.";
                    doc.hideButton("eraser-client");
                });
        },
        updateClientFrontEnd: function(wfmClientID, wfmClientName) {
            var clientHeader = document.getElementsByClassName("header-client")[0];
            var clientLink = document.createElement("a");
            var wfmClientURL = "https://practicemanager.xero.com/Client/" + wfmClientID + "/Detail";

            clientLink.className = "wfm-client-link";
            clientLink.setAttribute("data-wfm-id", wfmClientID);
            clientLink.setAttribute("data-wfm-name", wfmClientName);
            clientLink.href = wfmClientURL;
            clientLink.innerHTML = wfmClientName;
            clientHeader.innerHTML = "Client detected as ";
            clientHeader.appendChild(clientLink);
        },
        initialize: function() {
            this.hideWrongButtons();
            this.checkForConnectedClient();
            // console.log(domHelper.ticket.getTicketInfo());
            // console.log(domHelper.ticket.getContactInfo());
        }
    };
})();

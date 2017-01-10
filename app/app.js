/**
 * global: domHelper
 * global: page_type
 **/

(function() {
    "use strict";
    return {
        events: [
            { event: 'click', selector: '.creator-task', callback: 'createTask' },
            { event: 'click', selector: '.dropdown-job-item', callback: 'confirmJob' },
            { event: 'click', selector: '.dropdown-task-item', callback: 'confirmTask' },
            { event: 'click', selector: '.eraser-task', callback: 'resetTask' },
            { event: 'click', selector: '.creator-client', callback: 'createClient' },
            { event: 'click', selector: '.detective-client', callback: 'detectClient' },
            { event: 'click', selector: '.confirmer-client', callback: 'confirmClient' },
            { event: 'click', selector: '.eraser-client', callback: 'resetClient' }
        ],
        createTask: function() {
            var ticket = domHelper.ticket.getTicketInfo().helpdesk_ticket;
            var jobName = this.$container.getElementsByClassName("dropdown-job-button")[0].dataset.wfmJobName;
            var jobID = this.$container.getElementsByClassName("dropdown-job-button")[0].dataset.wfmJobId;
            var clientName = this.$container.getElementsByClassName("wfm-client-link")[1].dataset.wfmName;
            var highestTaskID = this.$container.getElementsByClassName("dropdown-task-content")[0].dataset.wfmHighestTaskId;
            if (confirm("This will create a new Task in WorkFlow Max called 'Helpdesk Ticket # "
                    + ticket.display_id
                    + "' under the job '"
                    + jobName
                    + "' for the client '"
                    + clientName
                    + "'. Continue?")) {
                var wfmURL = "https://api.workflowmax.com/job.api/task?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
                var taskXML = "<Task>"
                    + "<Job>" + jobID + "</Job>"
                    + "<TaskID>" + (parseInt(highestTaskID) + 1) + "</TaskID>" // fix this to figure out task ID of the helpdesk task
                    + "<Label>" + ticket.display_id + "</Label>"
                    + "<Description>Generated in Freshdesk</Description>"
                    + "</Task>";
                this.$request.post(wfmURL, {body: taskXML})
                    .done(function(data) {
                        var response = new window.DOMParser().parseFromString(data.response, "text/html");
console.log(response);
                    })
                    .fail(function(err) {

                    });
            }
        },
        createClient: function() {
            var doc = this;
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title;
            var contact = domHelper.contact.getContactInfo().user;

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
                .done(function(data) {
                    var response = new window.DOMParser().parseFromString(data.response, "text/html");
                    var wfmClientID = response.getElementsByTagName("ID")[0].innerHTML;
                    var wfmClientName = response.getElementsByTagName("Name")[0].innerHTML;
                    doc.updateClientFrontEnd(wfmClientID, wfmClientName);
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        populateJobDropdown: function(wfmClientID) {
            var wfmURL = "https://api.workflowmax.com/job.api/client/" + wfmClientID + "?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>&query=";
            var dropdownContent = this.$container.getElementsByClassName("dropdown-job-content")[0];

            this.$request.get(wfmURL)
                .done(function(data) {
                    var response = new window.DOMParser().parseFromString(data.response, "text/html");
                    var jobs = response.getElementsByTagName("Job");
                    jQuery(jobs).each(function() {
                        var wfmJobID = $(this).getElementsByTagName("ID")[0].innerHTML;
                        var wfmJobName = $(this).getElementsByTagName("Name")[0].innerHTML;
                        var dropdownOption = document.createElement("li");
                        dropdownOption.className = "dropdown-job-item dropdown-item";
                        dropdownOption.setAttribute("data-wfm-job-id", wfmJobID);
                        dropdownOption.setAttribute("data-wfm-job-name", wfmJobName);
                        dropdownOption.innerHTML = wfmJobID + ": " + wfmJobName;
                        dropdownContent.appendChild(dropdownOption);
                    });
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        populateTaskDropdown: function(wfmJobID) {
            var wfmURL = "https://api.workflowmax.com/job.api/get/" + wfmJobID + "?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            var dropdownContent = this.$container.getElementsByClassName("dropdown-task-content")[0];

            this.$request.get(wfmURL)
                .done(function(data) {
                    var response = new window.DOMParser().parseFromString(data.response, "text/html");
                    var tasks = response.getElementsByTagName("Task");
                    var highestID = 0;
                    jQuery(tasks).each(function() {
                        var wfmTaskID = $(this).getElementsByTagName("ID")[0].innerHTML;
                        if (wfmTaskID > highestID) {
                            highestID = wfmTaskID;
                        }
                        var wfmTaskName = $(this).getElementsByTagName("Name")[0].innerHTML;
                        var dropdownOption = document.createElement("li");
                        dropdownOption.className = "dropdown-task-item dropdown-item";
                        dropdownOption.setAttribute("data-wfm-task-id", wfmTaskID);
                        dropdownOption.setAttribute("data-wfm-task-name", wfmTaskName);
                        dropdownOption.innerHTML = "ID" + wfmTaskID + ": " + wfmTaskName;

                        if ($(this).getElementsByTagName("Label")[0] !== undefined) {
                            var wfmTaskLabel = $(this).getElementsByTagName("Label")[0].innerHTML;
                            dropdownOption.setAttribute("data-wfm-task-label", wfmTaskLabel);
                            dropdownOption.innerHTML += wfmTaskLabel;
                        }
                        dropdownContent.appendChild(dropdownOption);
                    });
                    dropdownContent.setAttribute("data-wfm-highest-task-id", highestID);
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        updateJobDropdown: function(wfmJobID, wfmJobName) {
            var jobButton = this.$container.getElementsByClassName("dropdown-job-button")[0];
            jobButton.innerHTML = wfmJobID + ": " + wfmJobName;
            jobButton.setAttribute("data-wfm-job-id", wfmJobID);
            jobButton.setAttribute("data-wfm-job-name", wfmJobName);
        },
        updateTaskDropdown: function(wfmTaskID, wfmTaskName, wfmTaskLabel) {
            this.$container.getElementsByClassName("dropdown-task-button")[0].innerHTML = wfmTaskID + ": " + wfmTaskName + wfmTaskLabel;
        },
        confirmClient: function() {
            var doc = this;
            var wfmLink = this.$container.getElementsByClassName("wfm-client-link")[0];
            var companyID = domHelper.contact.getContactInfo().customer_id;
            var detectedClientName = wfmLink.dataset.wfmName;
            var detectedClientID = wfmLink.dataset.wfmId;

            this.$db.set( "client:" + companyID,
                { "wfmClientID": detectedClientID, "wfmClientName": detectedClientName })
                .done(function() {
                    doc.updateClientFrontEnd(detectedClientID, detectedClientName);
                    doc.hideByClass("confirmer-client");
                    doc.hideByClass("detective-client");
                    doc.hideByClass("creator-client");
                    doc.showByClass("eraser-client");
                    doc.$container.getElementsByClassName("header-client")[0].innerHTML = doc.$container.getElementsByClassName("header-client")[0].innerHTML.replace("detected", "saved");
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        confirmJob: function(event) {
            var wfmJobID = event.target.dataset.wfmJobId;
            var wfmJobName = event.target.dataset.wfmJobName;
            var doc = this;
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;

            this.$db.set( "ticket:" + ticketID + ":job",
                { "wfmJobID": wfmJobID, "wfmJobName" : wfmJobName })
                .done(function() {
                    doc.showByClass("creator-task");
                    doc.updateJobDropdown(wfmJobID, wfmJobName);
                    doc.populateTaskDropdown(wfmJobID);
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        confirmTask: function(event) {
            var wfmTaskID = event.target.dataset.wfmTaskId;
            var wfmTaskName = event.target.dataset.wfmTaskName;
            if (event.target.dataset.wfmTaskLabel !== undefined) {
                var wfmTaskLabel = event.target.dataset.wfmTaskLabel;
            } else {
                wfmTaskLabel = "";
            }
            var doc = this;
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;

            this.$db.set( "ticket:" + ticketID + ":task",
                { "wfmTaskID": wfmTaskID, "wfmTaskName": wfmTaskName, "wfmTaskLabel": wfmTaskLabel })
                .done(function() {
                    doc.hideByClass("creator-task");
                    doc.updateTaskFrontEnd(wfmTaskID, wfmTaskName, wfmTaskLabel);
                    doc.updateTaskDropdown(wfmTaskID, wfmTaskName, wfmTaskLabel);
                    doc.$container.getElementsByClassName("header-task")[0].innerHTML = doc.$container.getElementsByClassName("header-task")[0].innerHTML.replace("detected", "saved");
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
                    .done(function() {
                        location.reload();
                    })
                    .fail(function(err) {
                        alert(err);
                    });
            }
        },
        resetTask: function() {
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            var ticketDesc = domHelper.ticket.getTicketInfo().helpdesk_ticket.description;
            var detectedTaskName = this.$container.getElementsByClassName("wfm-task-link")[0].innerHTML;

            if (confirm("Are you sure you want to erase the connection between ticket '"
                    + ticketID
                    + ": "
                    + ticketDesc
                    + "' and the WorkFlow Max task '"
                    + detectedTaskName
                    + "'?")) {
                this.$db.delete ( "ticket:" + ticketID + ":task")
                    .done(function() {
                        location.reload();
                    })
                    .fail(function(err) {
                        alert(err);
                    });
            }
        },
        hideByClass: function(className) {
            this.$container.getElementsByClassName(className)[0].style.display = 'none';
        },
        showByClass: function(className) {
            this.$container.getElementsByClassName(className)[0].style.display = 'block';
        },
        hideWrongButtons: function() {
            if (page_type == "ticket") {
                this.hideByClass("holder-client");
            } else if (page_type == "contact") {
                this.hideByClass("holder-task");
            }
        },
        checkForConnectedClient: function() {
            var doc = this;
            if (page_type === "contact") {
                var clientID = domHelper.contact.getContactInfo().customer_id;
            } else if (page_type === "ticket") {
                clientID = domHelper.ticket.getContactInfo().customer_id;
            }
            this.$db.get("client:" + clientID)
                .done(function(data) {
                    doc.updateClientFrontEnd(data.wfmClientID, data.wfmClientName);
                    if (page_type === "ticket") {
                        doc.populateJobDropdown(data.wfmClientID);
                    }
                    doc.hideByClass("creator-client");
                    doc.hideByClass("detective-client");
                    doc.hideByClass("confirmer-client");
                })
                .fail(function() {
                    doc.$container.getElementsByClassName("header-client")[0].innerHTML = "No client connected.";
                    doc.hideByClass("eraser-client");
                });
        },
        checkForConnectedTask: function() {
            var doc = this;
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            this.$db.get("ticket:" + ticketID + ":task")
                .done(function(data) {
                    if (data.wfmTaskID && data.wfmTaskName) {
                        doc.updateTaskFrontEnd(data.wfmTaskID, data.wfmTaskName, data.wfmTaskLabel);
                        doc.hideByClass("creator-task");
                        doc.hideByClass("dropdown-job");
                        doc.hideByClass("dropdown-task");
                        doc.showByClass("eraser-task");
                    }
                })
                .fail(function() {
                    doc.$container.getElementsByClassName("header-task")[0].innerHTML = "No task connected.";
                });
        },
        updateClientFrontEnd: function(wfmClientID, wfmClientName) {
            if (page_type === "ticket") {
                var header = "header-task-client";
            } else if (page_type === "contact") {
                header = "header-client";
            }
            var clientHeader = document.getElementsByClassName(header)[0];
            var clientLink = document.createElement("a");
            var wfmClientURL = "https://practicemanager.xero.com/Client/" + wfmClientID + "/Detail";

            clientLink.className = "wfm-client-link";
            clientLink.setAttribute("data-wfm-id", wfmClientID);
            clientLink.setAttribute("data-wfm-name", wfmClientName);
            clientLink.href = wfmClientURL;
            clientLink.innerHTML = wfmClientName;
            clientHeader.innerHTML = "Client detected: ";
            clientHeader.appendChild(clientLink);
        },
        updateTaskFrontEnd: function(wfmTaskID, wfmTaskName, wfmTaskLabel) {
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            if (wfmTaskLabel === undefined) {
                wfmTaskLabel = "";
            }
            this.$db.get("ticket:" + ticketID + ":job")
                .done(function(data) {
                    var taskHeader = document.getElementsByClassName("header-task")[0];
                    var taskLink = document.createElement("a");
                    var wfmTaskURL = "https://my.workflowmax.com/job/jobtaskview.aspx?id=" + wfmTaskID;

                    taskLink.className = "wfm-task-link";
                    taskLink.setAttribute("data-wfm-job-id", data.wfmJobID);
                    taskLink.setAttribute("data-wfm-task-id", wfmTaskID);
                    taskLink.setAttribute("data-wfm-task-name", wfmTaskName);
                    taskLink.setAttribute("data-wfm-task-label", wfmTaskLabel);
                    taskLink.href = wfmTaskURL;
                    taskLink.innerHTML = data.wfmJobID + ": " + wfmTaskName + wfmTaskLabel;
                    taskHeader.innerHTML = "Task detected: ";
                    taskHeader.appendChild(taskLink);
                })
                .fail(function(err) {
                    alert(err);
            });
        },
        initialize: function() {
            this.hideWrongButtons();
            if (page_type === "ticket") {
                this.checkForConnectedTask();
            }
            this.checkForConnectedClient();
        }
    };
})();

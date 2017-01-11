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
            { event: 'click', selector: '.eraser-client', callback: 'resetClient' },
            { event: 'click', selector: '.ship-it', callback: 'shipEight' }
        ],
        /**
         * Function to create a new WFM task based on the job selected in the dropdown and the ticket number
         * Will also save the connection to the database once chosen
         */
        createTask: function() {
            var doc = this;
            /** global: domHelper */
            var ticket = domHelper.ticket.getTicketInfo().helpdesk_ticket;
            var jobName = this.$container.getElementsByClassName("dropdown-job-button")[0].dataset.wfmJobName;
            var jobID = this.$container.getElementsByClassName("dropdown-job-button")[0].dataset.wfmJobId;
            var clientName = this.$container.getElementsByClassName("wfm-client-link")[1].dataset.wfmName;
            var wfmTasksURL = "https://api.workflowmax.com/task.api/list?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            var helpdeskTaskID = 0;

            this.$request.get(wfmTasksURL)
                .done(function(data) {
                    var response = new window.DOMParser().parseFromString(data.response, "text/html");
                    var tasks = response.getElementsByTagName("task");
                    jQuery(tasks).each(function() {
                        if ($(this).getElementsByTagName("name")[0].innerHTML.includes("Helpdesk ticket #")) {
                            helpdeskTaskID = $(this).getElementsByTagName("id")[0].innerHTML;

                            if (confirm("This will create a new Task in WorkFlow Max called 'Helpdesk ticket # - "
                                    + ticket.display_id
                                    + "' under the job '"
                                    + jobName
                                    + "' for the client '"
                                    + clientName
                                    + "'. Continue?")) {
                                var wfmURL = "https://api.workflowmax.com/job.api/task?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
                                var taskXML = "<Task>"
                                    + "<Job>" + jobID + "</Job>"
                                    + "<TaskID>" + helpdeskTaskID + "</TaskID>"
                                    + "<EstimatedMinutes>0</EstimatedMinutes>"
                                    + "<Label>" + ticket.display_id + "</Label>"
                                    + "<Description>Generated in Freshdesk</Description>"
                                    + "</Task>";
                                doc.$request.post(wfmURL, {body: taskXML})
                                    .done(function(data) {
                                        var response = new window.DOMParser().parseFromString(data.response, "text/html");
                                        var taskID = response.getElementsByTagName("id")[0].innerHTML;
                                        doc.updateTaskFrontEnd(taskID, "Helpdesk ticket #", ticket.display_id);
                                        doc.confirmNewTask(taskID, "Helpdesk ticket #", ticket.display_id);
                                    })
                                    .fail(function(err) {
                                        alert(err);
                                    });
                            }
                        }
                    });
                    if (helpdeskTaskID === 0) {
                        alert("No Helpdesk Ticket Task found!");
                    }
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        /**
         * Task to create a skeleton Client in Workflow Max from the contact screen. At the moment, you have to do this
         * from a contact as you can't host a widget on a company. This will set the contact you are set on as the
         * primary contact in WFM.
         */
        createClient: function() {
            var doc = this;
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title; // Naughty hack
            /** global: domHelper */
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
        /**
         * This uses a bit of stab-in-the-dark technique to try and guess the appropriate WFM Client if it already exists
         */
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
                    doc.showByClass("confirmer-client");
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        /**
         * Function to call WFM and fill the Job Dropdown based on the Client that raised the ticket
         * @param wfmClientID
         */
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
        /**
         * Function to populate the Task dropdown based on the Job selected in the dropdown above.
         * @param wfmJobID
         */
        populateTaskDropdown: function(wfmJobID) {
            var wfmURL = "https://api.workflowmax.com/job.api/get/" + wfmJobID + "?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            var dropdownContent = this.$container.getElementsByClassName("dropdown-task-content")[0];

            this.$request.get(wfmURL)
                .done(function(data) {
                    var response = new window.DOMParser().parseFromString(data.response, "text/html");
                    var tasks = response.getElementsByTagName("Task");
                    var helpdeskTaskID = 0;
                    jQuery(tasks).each(function() {
                        var wfmTaskID = $(this).getElementsByTagName("ID")[0].innerHTML;
                        var wfmTaskName = $(this).getElementsByTagName("Name")[0].innerHTML;
                        if (wfmTaskName.includes("Helpdesk ticket #")) {
                            helpdeskTaskID = wfmTaskID;
                        }
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
                    dropdownContent.setAttribute("data-wfm-helpdesk-task-id", helpdeskTaskID);
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        // Helper functions to replace placeholder text and set some data-vars on click
        updateJobDropdown: function(wfmJobID, wfmJobName) {
            var jobButton = this.$container.getElementsByClassName("dropdown-job-button")[0];
            jobButton.innerHTML = wfmJobID + ": " + wfmJobName;
            jobButton.setAttribute("data-wfm-job-id", wfmJobID);
            jobButton.setAttribute("data-wfm-job-name", wfmJobName);
        },
        updateTaskDropdown: function(wfmTaskID, wfmTaskName, wfmTaskLabel) {
            this.$container.getElementsByClassName("dropdown-task-button")[0].innerHTML = wfmTaskID + ": " + wfmTaskName + wfmTaskLabel;
        },
        /**
         * Saves the client information to the Freshdesk DB storage. Also hides/shows buttons based on the new
         * arrangement.
         */
        confirmClient: function() {
            var doc = this;
            var wfmLink = this.$container.getElementsByClassName("wfm-client-link")[0];
            /** global: domHelper */
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
        /**
         * Saves the Job information to the Freshdesk DB storage, updates buttons, populates the task dropdown
         * @param event - the click event ie you picking something in the dropdown
         */
        confirmJob: function(event) {
            var wfmJobID = event.target.dataset.wfmJobId;
            var wfmJobName = event.target.dataset.wfmJobName;
            var doc = this;
            /** global: domHelper */
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
        /**
         * Saves the Task informaton to the Freshdesk DB storage, updates buttons.
         * @TODO hook this into the timekeeper so that it picks it up somehow.
         * @param event - the click event ie you picking something in the dropdown
         */
        confirmTask: function(event) {
            var wfmTaskID = event.target.dataset.wfmTaskId;
            var wfmTaskName = event.target.dataset.wfmTaskName;
            if (event.target.dataset.wfmTaskLabel !== undefined) {
                var wfmTaskLabel = event.target.dataset.wfmTaskLabel;
            } else {
                wfmTaskLabel = "";
            }
            var doc = this;
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;

            this.$db.set( "ticket:" + ticketID + ":task",
                { "wfmTaskID": wfmTaskID, "wfmTaskName": wfmTaskName, "wfmTaskLabel": wfmTaskLabel })
                .done(function() {
                    doc.hideByClass("creator-task");
                    doc.hideByClass("dropdown-job");
                    doc.hideByClass("dropdown-task");
                    doc.showByClass("ship-it");
                    doc.showByClass("eraser-task");
                    doc.updateTaskFrontEnd(wfmTaskID, wfmTaskName, wfmTaskLabel);
                    doc.updateTaskDropdown(wfmTaskID, wfmTaskName, wfmTaskLabel);
                    doc.$container.getElementsByClassName("header-task")[0].innerHTML = doc.$container.getElementsByClassName("header-task")[0].innerHTML.replace("detected", "saved");
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        /**
         * Saves a newly created Task to teh Freshdesk DB storage, updates buttons
         * @param wfmTaskID
         * @param wfmTaskName
         * @param wfmTaskLabel
         */
        confirmNewTask: function(wfmTaskID, wfmTaskName, wfmTaskLabel) {
            var doc = this;
            if (wfmTaskLabel === undefined) {
                wfmTaskLabel = "";
            }
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;

            this.$db.set( "ticket:" + ticketID + ":task",
                { "wfmTaskID": wfmTaskID, "wfmTaskName": wfmTaskName, "wfmTaskLabel": wfmTaskLabel })
                .done(function() {
                    doc.hideByClass("creator-task");
                    doc.hideByClass("dropdown-job");
                    doc.hideByClass("dropdown-task");
                    doc.showByClass("eraser-task");
                    doc.showByClass("ship-it");
                    doc.updateTaskFrontEnd(wfmTaskID, wfmTaskName, wfmTaskLabel);
                    doc.updateTaskDropdown(wfmTaskID, wfmTaskName, wfmTaskLabel);
                    doc.$container.getElementsByClassName("header-task")[0].innerHTML = doc.$container.getElementsByClassName("header-task")[0].innerHTML.replace("detected", "saved");
                })
                .fail(function(err) {
                    alert(err);
                });
        },
        /**
         * Deletes the DB entry for the client that ties together the WFM client and the Freshdesk Company.
         */
        resetClient: function() {
            var hackCompanyName = document.getElementsByClassName("user-company-name")[0].title;
            var wfmLink = this.$container.getElementsByClassName("wfm-client-link")[0];
            /** global: domHelper */
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
        /**
         * Deletes the DB entry for the task that ties together the WFM task and the Freshdesk ticket.
         */
        resetTask: function() {
            /** global: domHelper */
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
        // Helper functions to toggle buttons (usually)
        hideByClass: function(className) {
            this.$container.getElementsByClassName(className)[0].style.display = 'none';
        },
        showByClass: function(className) {
            this.$container.getElementsByClassName(className)[0].style.display = 'block';
        },
        hideWrongButtons: function() {
            /** global: page_type */
            if (page_type == "ticket") {
                this.hideByClass("holder-client");
            } else if (page_type == "contact") {
                this.hideByClass("holder-task");
            }
        },
        /**
         * Checks the Freshdesk DB for stored info about linked Client and Company, updates buttons accordingly
         */
        checkForConnectedClient: function() {
            var doc = this;
            /** global: page_type */
            if (page_type === "contact") {
                /** global: domHelper */
                var clientID = domHelper.contact.getContactInfo().customer_id;
            } else if (page_type === "ticket") {
                clientID = domHelper.ticket.getContactInfo().customer_id;
            }
            this.$db.get("client:" + clientID)
                .done(function(data) {
                    doc.updateClientFrontEnd(data.wfmClientID, data.wfmClientName);
                    /** global: page_type */
                    if (page_type === "ticket") {
                        doc.populateJobDropdown(data.wfmClientID);
                    }
                    doc.hideByClass("creator-client");
                    doc.hideByClass("detective-client");
                    doc.hideByClass("confirmer-client");
                    doc.showByClass("eraser-client");
                })
                .fail(function() {
                    doc.$container.getElementsByClassName("header-client")[0].innerHTML = "No client connected.";
                    doc.hideByClass("eraser-client");
                });
        },
        /**
         * Checks the Freshdesk DB for stored info about linked Task and Ticket, updates buttons accordingly
         */
        checkForConnectedTask: function() {
            var doc = this;
            /** global: domHelper */
            var ticketID = domHelper.ticket.getTicketInfo().helpdesk_ticket.display_id;
            this.$db.get("ticket:" + ticketID + ":task")
                .done(function(data) {
                    if (data.wfmTaskID && data.wfmTaskName) {
                        doc.updateTaskFrontEnd(data.wfmTaskID, data.wfmTaskName, data.wfmTaskLabel);
                        doc.hideByClass("creator-task");
                        doc.hideByClass("dropdown-job");
                        doc.hideByClass("dropdown-task");
                        doc.showByClass("eraser-task");
                        doc.showByClass("ship-it");
                    }
                })
                .fail(function() {
                    doc.$container.getElementsByClassName("header-task")[0].innerHTML = "No task connected.";
                });
        },
        /**
         * Updates app box to reflect detected Client
         * @param wfmClientID
         * @param wfmClientName
         */
        updateClientFrontEnd: function(wfmClientID, wfmClientName) {
            /** global: page_type */
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
        /**
         * Updates app box to reflect detected Task
         * @param wfmTaskID
         * @param wfmTaskName
         * @param wfmTaskLabel
         */
        updateTaskFrontEnd: function(wfmTaskID, wfmTaskName, wfmTaskLabel) {
            /** global: domHelper */
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
        /**
         * Magic button to push 8 hours of time against one ticket. Mucho Spaghetti here.
         */
        shipEight: function() {
            var doc = this;
            var wfmStafflistURL = "https://api.workflowmax.com/staff.api/list?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            var wfmTimesheetURL = "https://api.workflowmax.com/time.api/add?apiKey=<%= iparam.wfm_api_key %>&accountKey=<%= iparam.wfm_acc_key %>";
            var wfmTaskLink = this.$container.getElementsByClassName("wfm-task-link")[0];
            var jobID = wfmTaskLink.dataset.wfmJobId;
            var taskName = wfmTaskLink.dataset.wfmTaskName + wfmTaskLink.dataset.wfmTaskLabel;
            /** global: domHelper */
            var agentEmail = domHelper.getAgentEmail();
            var agentID = 0;
            var date = new Date();
            // Hacked together datestring to ensure a) month/day have 2 digits each and b) it fits WFM convention
            var dateString = "" + date.getFullYear() + ("0" + (date.getMonth() + 1)).slice(-2) + ("0" + date.getDate()).slice(-2);

            // List all staff and get ID of one that matches the agent email
            this.$request.get(wfmStafflistURL)
                .done(function(data) {
                    var response = new window.DOMParser().parseFromString(data.response, "text/html");
                    var staff = response.getElementsByTagName("staff");
                    jQuery(staff).each(function() {
                        if ($(this).getElementsByTagName("email")[0].innerHTML === agentEmail) {
                            agentID = $(this).getElementsByTagName("id")[0].innerHTML;

                            if (confirm("You want to ship 8 hours against the task " + taskName + "?")) {
                                var logTimeXML = "<Timesheet>"
                                    + "<Job>" + jobID + "</Job>"
                                    + "<Task>" + wfmTaskLink.dataset.wfmTaskId + "</Task>"
                                    + "<Staff>" + agentID + "</Staff>"
                                    + "<Date>" + dateString + "</Date>"
                                    + "<Minutes>480</Minutes>"
                                    + "<Note>Shipped from Freshdesk</Note>"
                                    + "</Timesheet>";
                                doc.$request.post(wfmTimesheetURL, {body: logTimeXML})
                                    .done(function(data) {
                                        console.log(data);
                                        jQuery(doc.$container.getElementsByClassName("ship-it-icon")).each(function() {
                                            $(this).className = "fa fa-ship";
                                        });
                                        doc.$container.getElementsByClassName("ship-it")[0].innerHTML = doc.$container.getElementsByClassName("ship-it")[0].innerHTML.replace("I've spent all day here", "Shipped");
                                    })
                                    .fail(function(err) {
                                        alert(err);
                                    });
                            }
                        }
                    });
                    if (agentID === 0) {
                        alert("No Workflow Max user found for email address: " + agentEmail);
                    }
                })
                .fail(function(err) {
                    alert("Staff ID not found:" + err);
                });
        },
        /**
         * Function what makes it go like.
         */
        initialize: function() {
            this.hideWrongButtons();
            /** global: page_type */
            if (page_type === "ticket") {
                this.checkForConnectedTask();
            }
            this.checkForConnectedClient();
        }
    };
})();

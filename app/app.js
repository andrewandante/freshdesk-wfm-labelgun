(function() {
  "use strict";
  return {
    events: [
        { event: 'click', selector: '#labelGun', callback: 'applyLabel' }
    ],
    applyLabel: function () {
        alert("You clicked!!");
    },
    initialize: function() {
      if(page_type == "ticket") {
        console.log(domHelper.ticket.getTicketInfo());
      }
    }
  };
})();

/*
{%comment%}

## Help: Using iparam (​installation parameters) in code

iparam: The ​settings that you want your users to configure when installing the
app.

iparam definition is made in config/iparam_en.yml file. To use the defined
iparam in code, use Liquid notation like:

- {{iparam.username}}
- {{iparam.country}}

{%endcomment%}
*/

// this is a skeleton component for holding the raw html
// used for templating cards by users
// it's uh .. scary and awful.  but all in the name of ease for card game developers
var CardMarkup = React.createClass({
  getInitialState: function(){
    return {
      markup: this.props.markup
    };
  },
  // live dangerously
  markup: function(){
    return { __html: this.state.markup };
  },
  render: function(){
    return (
      <div dangerouslySetInnerHTML={this.markup()} />
    );
  }
});

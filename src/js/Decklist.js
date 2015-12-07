var Decklist = React.createClass({
  getInitialState: function(){
    var socket = io.connect();
    socket.emit('initDecks');
    return {
      socket: socket,
      decks: []
    };
  },
  componentDidMount: function(){
    this.state.socket.on('updateDecks', this.updateDecks);
  },
  updateDecks: function(data){
    this.setState({decks: data.map(function(deck){ return <Deck key={deck} name={deck} /> } )});
  },
  render: function(){
    return (
      <div className="decklist">
        <ul>
          {this.state.decks}
        </ul>
      </div>
    );
  }
});

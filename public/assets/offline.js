document.getElementById('retry').addEventListener('click', () => location.reload());
addEventListener('online', () => {
  document.getElementById('connection-status').textContent = 'Your connection may be back. Choose Try again to return to the game.';
});

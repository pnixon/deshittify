<?php

function url_exists($url) {
	$file_headers = @get_headers($url);
	if($file_headers[0] == 'HTTP/1.1 404 Not Found') {
		$exists = false;
	}
	else {
		$exists = true;
	}

	return $exists;
}

$feedUri = "";
if (isset($_POST['feed_uri'])) {
	$feedUri = $_POST['feed_uri'];
}

$fileContents = "";
$data = null;

if (strlen($feedUri) > 0 && url_exists($feedUri)) {
	$fileContents = file_get_contents($feedUri);
	$data = json_decode($fileContents, true);
}


?>
<!DOCTYPE  html>
<html>
<head>
	<title>FTL Web Reader</title>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="description" content="FTL Web Reader.">
</head>
<body>
	<h1>FTL Web Reader</h1>
	<form id="feed_form" action="./reader.php" method="post">
		<label for="feed_uri">Feed</label>
		<input id="feed_uri" name="feed_uri" type="text" value="<?php echo urldecode($feedUri); ?>" />
		<input type="submit" value="Submit">
	</form>
<hr />
<?php if (isset($data)) { ?>
	<h2><?php echo $data["summary"]; ?></h2>
	<hr/>
	<?php foreach($data['items'] as $item) { ?>
		<h3><?php echo $item['name']; ?></h3>
		<p><?php echo $item['content']; ?></p>
		<h4>By <?php echo $item['attributedTo'][0]['name']; ?></h4>
		<hr/>
	<?php } ?>
<?php } ?>
</body>
</html>
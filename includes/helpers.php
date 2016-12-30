<?php

    /**
    * Helper functions
    */

    /**
     * Apologizes to user with message.
     */

     function apologize($message)
     {
         render("apology.php", ["message" => $message]);
     }

     /**
     * Logs out the current user, if any.
     */

     function logout()
     {
         // Unset any session variables
         $_SESSION = [];

         // Expire cookie
         if (!empty($_COOKIE[session_name()]))
         {
             setcookie(session_name(), "",
             time() - 42000);
         }

         // Destroy session
         session_destroy();
     }

     /**
     * Redirects a user to location, which can be a URL or a relative path.
     */

     function redirect($location)
     {
         if (headers_sent($file, $line))
         {
             trigger_error("HTTP headers already sent at {$file}:{$line}",
             E_USER_ERROR);
         }
         header("Location: {$location}");
         exit;
     }

 ?>

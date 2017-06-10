/**
 * Created by C on 2017-06-09.
 */
module.exports = function(env){
    return function(req,res,next) {
        if (env !== 'development') {
            if (req.headers['x-forwarded-proto'] !== 'https')
                return res.redirect('https://www.walkinexpress.ca' + req.url);
            else
                next();
        }
        else {
            next();
        }
    };
};



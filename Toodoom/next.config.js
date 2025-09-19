/** @type {import('next').NextConfig} */
module.exports = {
    async rewrites() {
        return [
            { source: "/api/:path*", destination: `${process.env.BACKEND_URL}/api/:path*` },
        ];
    },
};